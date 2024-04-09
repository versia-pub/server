import type { Attachment } from "@prisma/client";
import type { Config } from "config-manager";
import { MediaBackendType } from "media-manager";
import type { APIAsyncAttachment } from "~types/entities/async_attachment";
import type { APIAttachment } from "~types/entities/attachment";
import type * as Lysand from "lysand-types";

export const attachmentToAPI = (
    attachment: Attachment,
): APIAsyncAttachment | APIAttachment => {
    let type = "unknown";

    if (attachment.mime_type.startsWith("image/")) {
        type = "image";
    } else if (attachment.mime_type.startsWith("video/")) {
        type = "video";
    } else if (attachment.mime_type.startsWith("audio/")) {
        type = "audio";
    }

    return {
        id: attachment.id,
        type: type as "image" | "video" | "audio" | "unknown",
        url: attachment.url,
        remote_url: attachment.remote_url,
        preview_url: attachment.thumbnail_url,
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
        [attachment.mime_type]: {
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

export const getUrl = (name: string, config: Config) => {
    if (config.media.backend === MediaBackendType.LOCAL) {
        return new URL(`/media/${name}`, config.http.base_url).toString();
    }
    if (config.media.backend === MediaBackendType.S3) {
        return new URL(`/${name}`, config.s3.public_url).toString();
    }
    return "";
};
