import { proxyUrl } from "@/response";
import type {
    AsyncAttachment as ApiAsyncAttachment,
    Attachment as ApiAttachment,
} from "@versia/client/types";
import type { ContentFormat } from "@versia/federation/types";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { Attachments } from "~/drizzle/schema";
import { MediaBackendType } from "~/packages/config-manager/config.type";
import { config } from "~/packages/config-manager/index";
import { BaseInterface } from "./base";

export type AttachmentType = InferSelectModel<typeof Attachments>;

export class Attachment extends BaseInterface<typeof Attachments> {
    static schema: z.ZodType<ApiAttachment> = z.object({
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

    async reload(): Promise<void> {
        const reloaded = await Attachment.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload attachment");
        }

        this.data = reloaded.data;
    }

    public static async fromId(id: string | null): Promise<Attachment | null> {
        if (!id) {
            return null;
        }

        return await Attachment.fromSql(eq(Attachments.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Attachment[]> {
        return await Attachment.manyFromSql(inArray(Attachments.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Attachments.id),
    ): Promise<Attachment | null> {
        const found = await db.query.Attachments.findFirst({
            where: sql,
            orderBy,
        });

        if (!found) {
            return null;
        }
        return new Attachment(found);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Attachments.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Attachments.findMany>[0],
    ): Promise<Attachment[]> {
        const found = await db.query.Attachments.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        return found.map((s) => new Attachment(s));
    }

    async update(
        newAttachment: Partial<AttachmentType>,
    ): Promise<AttachmentType> {
        await db
            .update(Attachments)
            .set(newAttachment)
            .where(eq(Attachments.id, this.id));

        const updated = await Attachment.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update attachment");
        }

        this.data = updated.data;
        return updated.data;
    }

    save(): Promise<AttachmentType> {
        return this.update(this.data);
    }

    async delete(ids: string[]): Promise<void>;
    async delete(): Promise<void>;
    async delete(ids?: unknown): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Attachments).where(inArray(Attachments.id, ids));
        } else {
            await db.delete(Attachments).where(eq(Attachments.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof Attachments>,
    ): Promise<Attachment> {
        const inserted = (
            await db.insert(Attachments).values(data).returning()
        )[0];

        const attachment = await Attachment.fromId(inserted.id);

        if (!attachment) {
            throw new Error("Failed to insert attachment");
        }

        return attachment;
    }

    get id() {
        return this.data.id;
    }

    public static getUrl(name: string) {
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

    public toApi(): ApiAttachment | ApiAsyncAttachment {
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
    ): Promise<Attachment> {
        const key = Object.keys(attachmentToConvert)[0];
        const value = attachmentToConvert[key];

        return Attachment.insert({
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
