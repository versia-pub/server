import { join } from "node:path";
import type { Attachment as AttachmentSchema } from "@versia/client/schemas";
import * as VersiaEntities from "@versia/sdk/entities";
import type {
    ContentFormatSchema,
    ImageContentFormatSchema,
} from "@versia/sdk/schemas";
import { config, MediaBackendType, ProxiableUrl } from "@versia-server/config";
import { randomUUIDv7, S3Client, SHA256, write } from "bun";
import {
    desc,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
    type SQL,
} from "drizzle-orm";
import sharp from "sharp";
import type { z } from "zod/v4";
import { mimeLookup } from "@/content_types.ts";
import { getMediaHash } from "../../../classes/media/media-hasher.ts";
import { ApiError } from "../api-error.ts";
import { MediaJobType, mediaQueue } from "../queues/media/queue.ts";
import { db } from "../tables/db.ts";
import { Medias } from "../tables/schema.ts";
import { BaseInterface } from "./base.ts";

type MediaType = InferSelectModel<typeof Medias>;

export class Media extends BaseInterface<typeof Medias> {
    public static $type: MediaType;

    public async reload(): Promise<void> {
        const reloaded = await Media.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload attachment");
        }

        this.data = reloaded.data;
    }

    public static async fromId(id: string | null): Promise<Media | null> {
        if (!id) {
            return null;
        }

        return await Media.fromSql(eq(Medias.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Media[]> {
        return await Media.manyFromSql(inArray(Medias.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Medias.id),
    ): Promise<Media | null> {
        const found = await db.query.Medias.findFirst({
            where: sql,
            orderBy,
        });

        if (!found) {
            return null;
        }
        return new Media(found);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Medias.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Medias.findMany>[0],
    ): Promise<Media[]> {
        const found = await db.query.Medias.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        return found.map((s) => new Media(s));
    }

    public async update(newAttachment: Partial<MediaType>): Promise<MediaType> {
        await db
            .update(Medias)
            .set(newAttachment)
            .where(eq(Medias.id, this.id));

        const updated = await Media.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update attachment");
        }

        this.data = updated.data;
        return updated.data;
    }

    public save(): Promise<MediaType> {
        return this.update(this.data);
    }

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Medias).where(inArray(Medias.id, ids));
        } else {
            await db.delete(Medias).where(eq(Medias.id, this.id));
        }

        // TODO: Also delete the file from the media manager
    }

    public static async insert(
        data: InferInsertModel<typeof Medias>,
    ): Promise<Media> {
        const inserted = (await db.insert(Medias).values(data).returning())[0];

        const attachment = await Media.fromId(inserted.id);

        if (!attachment) {
            throw new Error("Failed to insert attachment");
        }

        return attachment;
    }

    private static async upload(file: File): Promise<{
        path: string;
    }> {
        const fileName = file.name ?? randomUUIDv7();
        const hash = await getMediaHash(file);

        switch (config.media.backend) {
            case MediaBackendType.Local: {
                const path = join(config.media.uploads_path, hash, fileName);

                await write(path, file);

                return { path: join(hash, fileName) };
            }

            case MediaBackendType.S3: {
                const path = join(hash, fileName);

                if (!config.s3) {
                    throw new ApiError(500, "S3 configuration missing");
                }

                const client = new S3Client({
                    endpoint: config.s3.endpoint.origin,
                    region: config.s3.region,
                    bucket: config.s3.bucket_name,
                    accessKeyId: config.s3.access_key,
                    secretAccessKey: config.s3.secret_access_key,
                    virtualHostedStyle: !config.s3.path_style,
                });

                await client.write(path, file);
                const finalPath = config.s3.path
                    ? join(config.s3.path, path)
                    : path;

                return { path: finalPath };
            }
        }
    }

    public static async fromFile(
        file: File,
        options?: {
            description?: string;
            thumbnail?: File;
        },
    ): Promise<Media> {
        Media.checkFile(file);

        const { path } = await Media.upload(file);

        const url = Media.getUrl(path);

        let thumbnailUrl: URL | null = null;

        if (options?.thumbnail) {
            const { path } = await Media.upload(options.thumbnail);

            thumbnailUrl = Media.getUrl(path);
        }

        const content = await Media.fileToContentFormat(file, url, {
            description: options?.description,
        });
        const thumbnailContent =
            thumbnailUrl && options?.thumbnail
                ? await Media.fileToContentFormat(
                      options.thumbnail,
                      thumbnailUrl,
                      {
                          description: options?.description,
                      },
                  )
                : undefined;

        const newAttachment = await Media.insert({
            id: randomUUIDv7(),
            content,
            thumbnail: thumbnailContent as z.infer<
                typeof ImageContentFormatSchema
            >,
        });

        if (config.media.conversion.convert_images) {
            await mediaQueue.add(MediaJobType.ConvertMedia, {
                attachmentId: newAttachment.id,
                filename: file.name,
            });
        }

        await mediaQueue.add(MediaJobType.CalculateMetadata, {
            attachmentId: newAttachment.id,
            filename: file.name,
        });

        return newAttachment;
    }

    /**
     * Creates and adds a new media attachment from a URL
     * @param uri
     * @param options
     * @returns
     */
    public static async fromUrl(
        uri: URL,
        options?: {
            description?: string;
        },
    ): Promise<Media> {
        const mimeType = await mimeLookup(uri);

        const content: z.infer<typeof ContentFormatSchema> = {
            [mimeType]: {
                content: uri.toString(),
                remote: true,
                description: options?.description,
            },
        };

        const newAttachment = await Media.insert({
            id: randomUUIDv7(),
            content,
        });

        await mediaQueue.add(MediaJobType.CalculateMetadata, {
            attachmentId: newAttachment.id,
            // CalculateMetadata doesn't use the filename, but the type is annoying
            // and requires it anyway
            filename: "blank",
        });

        return newAttachment;
    }

    private static checkFile(file: File): void {
        if (file.size > config.validation.media.max_bytes) {
            throw new ApiError(
                413,
                `File too large, max size is ${config.validation.media.max_bytes} bytes`,
            );
        }

        if (
            config.validation.media.allowed_mime_types.length > 0 &&
            !config.validation.media.allowed_mime_types.includes(file.type)
        ) {
            throw new ApiError(
                415,
                `File type ${file.type} is not allowed`,
                `Allowed types: ${config.validation.media.allowed_mime_types.join(
                    ", ",
                )}`,
            );
        }
    }

    public async updateFromFile(file: File): Promise<void> {
        Media.checkFile(file);

        const { path } = await Media.upload(file);

        const url = Media.getUrl(path);

        const content = await Media.fileToContentFormat(file, url, {
            description:
                this.data.content[Object.keys(this.data.content)[0]]
                    ?.description || undefined,
        });

        await this.update({
            content,
        });

        await mediaQueue.add(MediaJobType.CalculateMetadata, {
            attachmentId: this.id,
            filename: file.name,
        });
    }

    public async updateFromUrl(uri: URL): Promise<void> {
        const mimeType = await mimeLookup(uri);

        const content: z.infer<typeof ContentFormatSchema> = {
            [mimeType]: {
                content: uri.toString(),
                remote: true,
                description:
                    this.data.content[Object.keys(this.data.content)[0]]
                        ?.description || undefined,
            },
        };

        await this.update({
            content,
        });

        await mediaQueue.add(MediaJobType.CalculateMetadata, {
            attachmentId: this.id,
            filename: "blank",
        });
    }

    public async updateThumbnail(file: File): Promise<void> {
        Media.checkFile(file);

        const { path } = await Media.upload(file);

        const url = Media.getUrl(path);

        const content = await Media.fileToContentFormat(file, url);

        await this.update({
            thumbnail: content as z.infer<typeof ImageContentFormatSchema>,
        });
    }

    public async updateMetadata(
        metadata: Partial<
            Omit<
                z.infer<typeof ContentFormatSchema>[keyof z.infer<
                    typeof ContentFormatSchema
                >],
                "content"
            >
        >,
    ): Promise<void> {
        const content = this.data.content;

        for (const type of Object.keys(content)) {
            content[type] = {
                ...content[type],
                ...metadata,
            } as (typeof content)[keyof typeof content];
        }

        await this.update({
            content,
        });
    }

    public get id(): string {
        return this.data.id;
    }

    public static getUrl(name: string): URL {
        if (config.media.backend === MediaBackendType.Local) {
            return new URL(`/media/${name}`, config.http.base_url);
        }
        if (config.media.backend === MediaBackendType.S3) {
            return new URL(`/${name}`, config.s3?.public_url);
        }

        throw new Error("Unknown media backend");
    }

    public getUrl(): ProxiableUrl {
        const type = this.getPreferredMimeType();

        return new ProxiableUrl(this.data.content[type]?.content ?? "");
    }

    /**
     * Gets favourite MIME type for the attachment
     * Uses a hardcoded list of preferred types, for images
     *
     * @returns {string} Preferred MIME type
     */
    public getPreferredMimeType(): string {
        return Media.getPreferredMimeType(Object.keys(this.data.content));
    }

    /**
     * Gets favourite MIME type from a list
     * Uses a hardcoded list of preferred types, for images
     *
     * @returns {string} Preferred MIME type
     */
    public static getPreferredMimeType(types: string[]): string {
        const ranking = [
            "image/svg+xml",
            "image/avif",
            "image/jxl",
            "image/webp",
            "image/heif",
            "image/heif-sequence",
            "image/heic",
            "image/heic-sequence",
            "image/apng",
            "image/gif",
            "image/png",
            "image/jpeg",
            "image/bmp",
        ];

        return ranking.find((type) => types.includes(type)) ?? types[0];
    }

    /**
     * Maps MIME type to Mastodon attachment type
     *
     * @returns
     */
    public getMastodonType(): z.infer<typeof AttachmentSchema.shape.type> {
        const type = this.getPreferredMimeType();

        if (type.startsWith("image/")) {
            return "image";
        }
        if (type.startsWith("video/")) {
            return "video";
        }
        if (type.startsWith("audio/")) {
            return "audio";
        }

        return "unknown";
    }

    /**
     * Extracts metadata from a file and outputs as ContentFormat
     *
     * Does not calculate thumbhash (do this in a worker)
     * @param file
     * @param uri Uploaded file URI
     * @param options Extra metadata, such as description
     * @returns
     */
    public static async fileToContentFormat(
        file: File,
        uri: URL,
        options?: Partial<{
            description: string;
        }>,
    ): Promise<z.infer<typeof ContentFormatSchema>> {
        const buffer = await file.arrayBuffer();
        const isImage = file.type.startsWith("image/");
        const { width, height } = isImage ? await sharp(buffer).metadata() : {};
        const hash = new SHA256().update(file).digest("hex");

        // Missing: fps, duration
        // Thumbhash should be added in a worker after the file is uploaded
        return {
            [file.type]: {
                content: uri.toString(),
                remote: true,
                hash: {
                    sha256: hash,
                },
                width,
                height,
                description: options?.description,
                size: file.size,
            },
        };
    }

    public toApiMeta(): z.infer<typeof AttachmentSchema.shape.meta> {
        const type = this.getPreferredMimeType();
        const data = this.data.content[type];

        if (!data) {
            throw new ApiError(
                500,
                `No content for type ${type} in attachment ${this.id}`,
            );
        }

        const size =
            data.width && data.height
                ? `${data.width}x${data.height}`
                : undefined;
        const aspect =
            data.width && data.height ? data.width / data.height : undefined;

        return {
            width: data.width || undefined,
            height: data.height || undefined,
            fps: data.fps || undefined,
            size,
            // Idk whether size or length is the right value
            duration: data.duration || undefined,
            // Versia doesn't have a concept of length in ContentFormat
            length: undefined,
            aspect,
            original: {
                width: data.width || undefined,
                height: data.height || undefined,
                size,
                aspect,
            },
        };
    }

    public toApi(): z.infer<typeof AttachmentSchema> {
        const type = this.getPreferredMimeType();
        const data = this.data.content[type];

        // Thumbnail should only have a single MIME type
        const thumbnailData =
            this.data.thumbnail?.[Object.keys(this.data.thumbnail)[0]];

        return {
            id: this.data.id,
            type: this.getMastodonType(),
            url: this.getUrl().proxied,
            remote_url: null,
            preview_url: thumbnailData?.content
                ? new ProxiableUrl(thumbnailData.content).proxied
                : null,
            meta: this.toApiMeta(),
            description: data?.description || null,
            blurhash: this.data.blurhash,
        };
    }

    public toVersia(): VersiaEntities.ContentFormat {
        return new VersiaEntities.ContentFormat(this.data.content);
    }

    public static fromVersia(
        contentFormat: VersiaEntities.ContentFormat,
    ): Promise<Media> {
        return Media.insert({
            id: randomUUIDv7(),
            content: contentFormat.data,
            originalContent: contentFormat.data,
        });
    }
}
