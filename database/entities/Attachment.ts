import type { Attachment } from "@prisma/client";
import type { ConfigType } from "config-manager";
import { MediaBackendType } from "media-manager";
import type { APIAsyncAttachment } from "~types/entities/async_attachment";
import type { APIAttachment } from "~types/entities/attachment";

export const attachmentToAPI = (
	attachment: Attachment
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
		type: type as any,
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

export const getUrl = (name: string, config: ConfigType) => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
	if (config.media.backend === MediaBackendType.LOCAL) {
		return `${config.http.base_url}/media/${name}`;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
	} else if (config.media.backend === MediaBackendType.S3) {
		return `${config.s3.public_url}/${name}`;
	}
	return "";
};
