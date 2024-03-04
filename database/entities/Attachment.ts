import type { ConfigType } from "~classes/configmanager";
import type { Attachment } from "@prisma/client";
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

export const getUrl = (hash: string, config: ConfigType) => {
	if (config.media.backend === "local") {
		return `${config.http.base_url}/media/${hash}`;
	} else if (config.media.backend === "s3") {
		return `${config.s3.public_url}/${hash}`;
	}
	return "";
};
