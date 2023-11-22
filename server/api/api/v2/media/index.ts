import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { encode } from "blurhash";
import { getFromRequest } from "~database/entities/User";
import { APIRouteMeta } from "~types/api";
import sharp from "sharp";
import { uploadFile } from "~classes/media";
import { getConfig } from "@config";
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
	},
});

/**
 * Fetch a user
 */
export default async (req: Request): Promise<Response> => {
	const { user } = await getFromRequest(req);

	if (!user) {
		return errorResponse("Unauthorized", 401);
	}

	const form = await req.formData();

	const file = form.get("file") as unknown as File | undefined;
	const thumbnail = form.get("thumbnail");
	const description = form.get("description");

	// Floating point numbers from -1.0 to 1.0, comma delimited
	// const focus = form.get("focus");

	if (!file) {
		return errorResponse("No file provided", 400);
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

	const config = getConfig();

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
			description: (description as string | undefined) ?? "",
			size: file.size,
			blurhash: blurhash ?? undefined,
			width: metadata?.width ?? undefined,
			height: metadata?.height ?? undefined,
		},
	});

	// TODO: Add job to process videos and other media

	return jsonResponse({
		...attachmentToAPI(newAttachment),
		url: undefined,
	});
};
