import { join } from "node:path";
import { mimeLookup } from "@/content_types.ts";
import { proxyUrl } from "@/response";
import type { Attachment as ApiAttachment } from "@versia/client/types";
import type { ContentFormat } from "@versia/federation/types";
import { db } from "@versia/kit/db";
import { Medias } from "@versia/kit/tables";
import { S3Client, SHA256, randomUUIDv7, write } from "bun";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { MediaBackendType } from "~/packages/config-manager/config.type";
import { config } from "~/packages/config-manager/index.ts";
import { ApiError } from "../errors/api-error.ts";
import { getMediaHash } from "../media/media-hasher.ts";
import { MediaJobType, mediaQueue } from "../queues/media.ts";
import { BaseInterface } from "./base.ts";

type MediaType = InferSelectModel<typeof Medias>;

export class Media extends BaseInterface<typeof Medias> {
    public static schema: z.ZodType<ApiAttachment> = z.object({
        id: z.string().uuid(),
        type: z.enum(["unknown", "image", "gifv", "video", "audio"]),
        url: z.string().url(),
        remote_url: z.string().url().nullable(),
        preview_url: z.string().url().nullable(),
        text_url: z.string().url().nullable(),
        meta: z
            .object({
                width: z.number().optional(),
                height: z.number().optional(),
                fps: z.number().optional(),
                size: z.string().optional(),
                duration: z.number().optional(),
                length: z.string().optional(),
                aspect: z.number().optional(),
                original: z.object({
                    width: z.number().optional(),
                    height: z.number().optional(),
                    size: z.string().optional(),
                    aspect: z.number().optional(),
                }),
            })
            .nullable(),
        description: z.string().nullable(),
        blurhash: z.string().nullable(),
    });

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
                const path = join(
                    config.media.local_uploads_folder,
                    hash,
                    fileName,
                );

                await write(path, file);

                return { path: join(hash, fileName) };
            }

            case MediaBackendType.S3: {
                const path = join(hash, fileName);

                if (!config.s3) {
                    throw new ApiError(500, "S3 configuration missing");
                }

                const client = new S3Client({
                    endpoint: config.s3.endpoint,
                    region: config.s3.region,
                    bucket: config.s3.bucket_name,
                    accessKeyId: config.s3.access_key,
                    secretAccessKey: config.s3.secret_access_key,
                });

                await client.write(path, file);

                return { path };
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

        let thumbnailUrl = "";

        if (options?.thumbnail) {
            const { path } = await Media.upload(options.thumbnail);

            thumbnailUrl = Media.getUrl(path);
        }

        const content = await Media.fileToContentFormat(file, url, {
            description: options?.description,
        });
        const thumbnailContent = options?.thumbnail
            ? await Media.fileToContentFormat(options.thumbnail, thumbnailUrl, {
                  description: options?.description,
              })
            : undefined;

        const newAttachment = await Media.insert({
            content,
            thumbnail: thumbnailContent,
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

    public static async fromUrl(
        uri: URL,
        options?: {
            description?: string;
        },
    ): Promise<Media> {
        const mimeType = await mimeLookup(uri);

        const content: ContentFormat = {
            [mimeType]: {
                content: uri.toString(),
                remote: true,
                description: options?.description,
            },
        };

        const newAttachment = await Media.insert({
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
        if (file.size > config.validation.max_media_size) {
            throw new ApiError(
                413,
                `File too large, max size is ${config.validation.max_media_size} bytes`,
            );
        }

        if (
            config.validation.enforce_mime_types &&
            !config.validation.allowed_mime_types.includes(file.type)
        ) {
            throw new ApiError(
                415,
                `File type ${file.type} is not allowed`,
                `Allowed types: ${config.validation.allowed_mime_types.join(", ")}`,
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
                    .description || undefined,
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

        const content: ContentFormat = {
            [mimeType]: {
                content: uri.toString(),
                remote: true,
                description:
                    this.data.content[Object.keys(this.data.content)[0]]
                        .description || undefined,
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
            thumbnail: content,
        });
    }

    public async updateMetadata(
        metadata: Partial<Omit<ContentFormat[keyof ContentFormat], "content">>,
    ): Promise<void> {
        const content = this.data.content;

        for (const type of Object.keys(content)) {
            content[type] = {
                ...content[type],
                ...metadata,
            };
        }

        await this.update({
            content,
        });
    }

    public get id(): string {
        return this.data.id;
    }

    public static getUrl(name: string): string {
        if (config.media.backend === MediaBackendType.Local) {
            return new URL(`/media/${name}`, config.http.base_url).toString();
        }
        if (config.media.backend === MediaBackendType.S3) {
            return new URL(`/${name}`, config.s3?.public_url).toString();
        }
        return "";
    }

    public getUrl(): string {
        const type = this.getPreferredMimeType();

        return this.data.content[type]?.content;
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
    public getMastodonType(): ApiAttachment["type"] {
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
        uri: string,
        options?: Partial<{
            description: string;
        }>,
    ): Promise<ContentFormat> {
        const buffer = await file.arrayBuffer();
        const isImage = file.type.startsWith("image/");
        const { width, height } = isImage ? await sharp(buffer).metadata() : {};
        const hash = new SHA256().update(file).digest("hex");

        // Missing: fps, duration
        // Thumbhash should be added in a worker after the file is uploaded
        return {
            [file.type]: {
                content: uri,
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

    public toApiMeta(): ApiAttachment["meta"] {
        const type = this.getPreferredMimeType();
        const data = this.data.content[type];
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

    public toApi(): ApiAttachment {
        const type = this.getPreferredMimeType();
        const data = this.data.content[type];

        // Thumbnail should only have a single MIME type
        const thumbnailData =
            this.data.thumbnail?.[Object.keys(this.data.thumbnail)[0]];

        return {
            id: this.data.id,
            type: this.getMastodonType(),
            url: proxyUrl(data.content) ?? "",
            remote_url: null,
            preview_url: proxyUrl(thumbnailData?.content),
            text_url: null,
            meta: this.toApiMeta(),
            description: data.description || null,
            blurhash: this.data.blurhash,
        };
    }

    public toVersia(): ContentFormat {
        return this.data.content;
    }

    public static fromVersia(contentFormat: ContentFormat): Promise<Media> {
        return Media.insert({
            content: contentFormat,
            originalContent: contentFormat,
        });
    }
}
