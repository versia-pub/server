import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { encode } from "blurhash";
import type { APIRouteMeta } from "~types/api";
import sharp from "sharp";
import { uploadFile } from "~classes/media";
import { attachmentToAPI, getUrl } from "~database/entities/Attachment";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 10,
		duration: 60,
	},
	route: "/api/v2/media",
	auth: {
		required: true,
		oauthPermissions: ["write:media"],
	},
});

/**
 * Upload new media
 */
export default apiRoute<{
	file: File;
	thumbnail: File;
	description: string;
	// TODO: Implement focus storage
	focus: string;
}>(async (req, matchedRoute, extraData) => {
	const { user } = extraData.auth;

	if (!user) {
		return errorResponse("Unauthorized", 401);
	}

	const { file, thumbnail, description } = extraData.parsedRequest;

	if (!file) {
		return errorResponse("No file provided", 400);
	}

	const config = await extraData.configManager.getConfig();

	if (file.size > config.validation.max_media_size) {
		return errorResponse(
			`File too large, max size is ${config.validation.max_media_size} bytes`,
			413
		);
	}

	if (
		config.validation.enforce_mime_types &&
		!config.validation.allowed_mime_types.includes(file.type)
	) {
		return errorResponse("Invalid file type", 415);
	}

	if (
		description &&
		description.length > config.validation.max_media_description_size
	) {
		return errorResponse(
			`Description too long, max length is ${config.validation.max_media_description_size} characters`,
			413
		);
	}

	const sha256 = new Bun.SHA256();

	const isImage = file.type.startsWith("image/");

	const metadata = isImage
		? await sharp(await file.arrayBuffer()).metadata()
		: null;

	const blurhash = isImage
		? encode(
				new Uint8ClampedArray(await file.arrayBuffer()),
				metadata?.width ?? 0,
				metadata?.height ?? 0,
				4,
				4
			)
		: null;

	let url = "";

	if (isImage) {
		const hash = await uploadFile(file, config);

		url = hash ? getUrl(hash, config) : "";
	}

	let thumbnailUrl = "";

	if (thumbnail) {
		const hash = await uploadFile(thumbnail as unknown as File, config);

		thumbnailUrl = hash ? getUrl(hash, config) : "";
	}

	const newAttachment = await client.attachment.create({
		data: {
			url,
			thumbnail_url: thumbnailUrl,
			sha256: sha256.update(await file.arrayBuffer()).digest("hex"),
			mime_type: file.type,
			description: description ?? "",
			size: file.size,
			blurhash: blurhash ?? undefined,
			width: metadata?.width ?? undefined,
			height: metadata?.height ?? undefined,
		},
	});

	// TODO: Add job to process videos and other media

	if (isImage) {
		return jsonResponse(attachmentToAPI(newAttachment));
	} else {
		return jsonResponse(
			{
				...attachmentToAPI(newAttachment),
				url: null,
			},
			202
		);
	}
});
