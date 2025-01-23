import { proxyUrl } from "@/response";
import type { Attachment as ApiAttachment } from "@versia/client/types";
import type { ContentFormat } from "@versia/federation/types";
import { db } from "@versia/kit/db";
import { Medias } from "@versia/kit/tables";
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
import { MediaManager } from "../media/media-manager.ts";
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

    public static async fromFile(
        file: File,
        options?: {
            description?: string;
            thumbnail?: File;
        },
    ): Promise<Media> {
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

        const sha256 = new Bun.SHA256();

        const isImage = file.type.startsWith("image/");

        const metadata = isImage
            ? await sharp(await file.arrayBuffer()).metadata()
            : null;

        const mediaManager = new MediaManager(config);

        const { path } = await mediaManager.addFile(file);

        const url = Media.getUrl(path);

        let thumbnailUrl = "";

        if (options?.thumbnail) {
            const { path } = await mediaManager.addFile(options.thumbnail);

            thumbnailUrl = Media.getUrl(path);
        }

        const newAttachment = await Media.insert({
            url,
            thumbnailUrl: thumbnailUrl || undefined,
            sha256: sha256.update(await file.arrayBuffer()).digest("hex"),
            mimeType: file.type,
            description: options?.description ?? "",
            size: file.size,
            width: metadata?.width ?? undefined,
            height: metadata?.height ?? undefined,
        });

        if (config.media.conversion.convert_images) {
            await mediaQueue.add(MediaJobType.ConvertMedia, {
                attachmentId: newAttachment.id,
                filename: file.name,
            });
        }

        return newAttachment;
    }

    public get id(): string {
        return this.data.id;
    }

    public static getUrl(name: string): string {
        if (config.media.backend === MediaBackendType.Local) {
            return new URL(`/media/${name}`, config.http.base_url).toString();
        }
        if (config.media.backend === MediaBackendType.S3) {
            return new URL(`/${name}`, config.s3.public_url).toString();
        }
        return "";
    }

    public getMastodonType(): ApiAttachment["type"] {
        if (this.data.mimeType.startsWith("image/")) {
            return "image";
        }
        if (this.data.mimeType.startsWith("video/")) {
            return "video";
        }
        if (this.data.mimeType.startsWith("audio/")) {
            return "audio";
        }

        return "unknown";
    }

    public toApiMeta(): ApiAttachment["meta"] {
        return {
            width: this.data.width || undefined,
            height: this.data.height || undefined,
            fps: this.data.fps || undefined,
            size:
                this.data.width && this.data.height
                    ? `${this.data.width}x${this.data.height}`
                    : undefined,
            duration: this.data.duration || undefined,
            length: undefined,
            aspect:
                this.data.width && this.data.height
                    ? this.data.width / this.data.height
                    : undefined,
            original: {
                width: this.data.width || undefined,
                height: this.data.height || undefined,
                size:
                    this.data.width && this.data.height
                        ? `${this.data.width}x${this.data.height}`
                        : undefined,
                aspect:
                    this.data.width && this.data.height
                        ? this.data.width / this.data.height
                        : undefined,
            },
            // Idk whether size or length is the right value
        };
    }

    public toApi(): ApiAttachment {
        return {
            id: this.data.id,
            type: this.getMastodonType(),
            url: proxyUrl(this.data.url) ?? "",
            remote_url: proxyUrl(this.data.remoteUrl),
            preview_url: proxyUrl(this.data.thumbnailUrl || this.data.url),
            text_url: null,
            meta: this.toApiMeta(),
            description: this.data.description,
            blurhash: this.data.blurhash,
        };
    }

    public toVersia(): ContentFormat {
        return {
            [this.data.mimeType]: {
                content: this.data.url,
                remote: true,
                // TODO: Replace BlurHash with thumbhash
                // thumbhash: this.data.blurhash ?? undefined,
                description: this.data.description ?? undefined,
                duration: this.data.duration ?? undefined,
                fps: this.data.fps ?? undefined,
                height: this.data.height ?? undefined,
                size: this.data.size ?? undefined,
                hash: this.data.sha256
                    ? {
                          sha256: this.data.sha256,
                      }
                    : undefined,
                width: this.data.width ?? undefined,
            },
        };
    }

    public static fromVersia(
        attachmentToConvert: ContentFormat,
    ): Promise<Media> {
        const key = Object.keys(attachmentToConvert)[0];
        const value = attachmentToConvert[key];

        return Media.insert({
            mimeType: key,
            url: value.content,
            description: value.description || undefined,
            duration: value.duration || undefined,
            fps: value.fps || undefined,
            height: value.height || undefined,
            // biome-ignore lint/style/useExplicitLengthCheck: Biome thinks we're checking if size is not zero
            size: value.size || undefined,
            width: value.width || undefined,
            sha256: value.hash?.sha256 || undefined,
            // blurhash: value.blurhash || undefined,
        });
    }
}
