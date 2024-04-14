import type { Config } from "config-manager";
import type { InferSelectModel } from "drizzle-orm";
import type * as Lysand from "lysand-types";
import { MediaBackendType } from "media-manager";
import { db } from "~drizzle/db";
import { attachment } from "~drizzle/schema";
import type { AsyncAttachment as APIAsyncAttachment } from "~types/mastodon/async_attachment";
import type { Attachment as APIAttachment } from "~types/mastodon/attachment";

export type Attachment = InferSelectModel<typeof attachment>;

export const attachmentToAPI = (
    attachment: Attachment,
): APIAsyncAttachment | APIAttachment => {
    let type = "unknown";

    if (attachment.mimeType.startsWith("image/")) {
        type = "image";
    } else if (attachment.mimeType.startsWith("video/")) {
        type = "video";
    } else if (attachment.mimeType.startsWith("audio/")) {
        type = "audio";
    }

    return {
        id: attachment.id,
        type: type as "image" | "video" | "audio" | "unknown",
        url: attachment.url,
        remote_url: attachment.remoteUrl,
        preview_url: attachment.thumbnailUrl,
        text_url: null,
        meta: {
            width: attachment.width || undefined,
            height: attachment.height || undefined,
            fps: attachment.fps || undefined,
            size:
                attachment.width && attachment.height
                    ? `${attachment.width}x${attachment.height}`
                    : undefined,
            duration: attachment.duration || undefined,
            length: attachment.size?.toString() || undefined,
            aspect:
                attachment.width && attachment.height
                    ? attachment.width / attachment.height
                    : undefined,
            original: {
                width: attachment.width || undefined,
                height: attachment.height || undefined,
                size:
                    attachment.width && attachment.height
                        ? `${attachment.width}x${attachment.height}`
                        : undefined,
                aspect:
                    attachment.width && attachment.height
                        ? attachment.width / attachment.height
                        : undefined,
            },
            // Idk whether size or length is the right value
        },
        description: attachment.description,
        blurhash: attachment.blurhash,
    };
};

export const attachmentToLysand = (
    attachment: Attachment,
): Lysand.ContentFormat => {
    return {
        [attachment.mimeType]: {
            content: attachment.url,
            blurhash: attachment.blurhash ?? undefined,
            description: attachment.description ?? undefined,
            duration: attachment.duration ?? undefined,
            fps: attachment.fps ?? undefined,
            height: attachment.height ?? undefined,
            size: attachment.size ?? undefined,
            hash: attachment.sha256
                ? {
                      sha256: attachment.sha256,
                  }
                : undefined,
            width: attachment.width ?? undefined,
        },
    };
};

export const attachmentFromLysand = async (
    attachmentToConvert: Lysand.ContentFormat,
): Promise<InferSelectModel<typeof attachment>> => {
    const key = Object.keys(attachmentToConvert)[0];
    const value = attachmentToConvert[key];

    const result = await db
        .insert(attachment)
        .values({
            mimeType: key,
            url: value.content,
            description: value.description || undefined,
            duration: value.duration || undefined,
            fps: value.fps || undefined,
            height: value.height || undefined,
            size: value.size || undefined,
            width: value.width || undefined,
            sha256: value.hash?.sha256 || undefined,
            blurhash: value.blurhash || undefined,
        })
        .returning();

    return result[0];
};

export const getUrl = (name: string, config: Config) => {
    if (config.media.backend === MediaBackendType.LOCAL) {
        return new URL(`/media/${name}`, config.http.base_url).toString();
    }
    if (config.media.backend === MediaBackendType.S3) {
        return new URL(`/${name}`, config.s3.public_url).toString();
    }
    return "";
};
