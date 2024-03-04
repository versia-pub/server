import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { encode } from "blurhash";
import { getFromRequest } from "~database/entities/User";
import type { APIRouteMeta } from "~types/api";
import sharp from "sharp";
import { uploadFile } from "~classes/media";
import { getConfig } from "~classes/configmanager";
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
export default async (req: Request): Promise<Response> => {
	const { user } = await getFromRequest(req);

	if (!user) {
		return errorResponse("Unauthorized", 401);
	}

	const form = await req.formData();

	const file = form.get("file") as unknown as File | undefined;
	const thumbnail = form.get("thumbnail");
	const description = form.get("description") as string | undefined;

	// Floating point numbers from -1.0 to 1.0, comma delimited
	// const focus = form.get("focus");

	if (!file) {
		return errorResponse("No file provided", 400);
	}

	const config = getConfig();

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
};
