/* eslint-disable @typescript-eslint/no-unused-vars */
import { getUserByToken } from "@auth";
import { getConfig } from "@config";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { Application } from "~database/entities/Application";
import { Status } from "~database/entities/Status";

/**
 * Post new status
 */
export default async (req: Request): Promise<Response> => {
	// Check if request is a PATCH request
	if (req.method !== "POST")
		return errorResponse("This method requires a POST request", 405);

	// Check auth token
	const token = req.headers.get("Authorization")?.split(" ")[1] || null;

	if (!token)
		return errorResponse("This method requires an authenticated user", 422);

	const user = await getUserByToken(token);
	const application = await Application.getFromToken(token);

	if (!user) return errorResponse("Unauthorized", 401);

	const config = getConfig();

	const {
		status,
		media_ids,
		"poll[expires_in]": expires_in,
		"poll[hide_totals]": hide_totals,
		"poll[multiple]": multiple,
		"poll[options]": options,
		in_reply_to_id,
		language,
		scheduled_at,
		sensitive,
		spoiler_text,
		visibility,
	} = await parseRequest<{
		status: string;
		media_ids?: string[];
		"poll[options]"?: string[];
		"poll[expires_in]"?: number;
		"poll[multiple]"?: boolean;
		"poll[hide_totals]"?: boolean;
		in_reply_to_id?: string;
		sensitive?: boolean;
		spoiler_text?: string;
		visibility?: "public" | "unlisted" | "private" | "direct";
		language?: string;
		scheduled_at?: string;
	}>(req);

	// Validate status
	if (!status) {
		return errorResponse("Status is required", 422);
	}

	if (status.length > config.validation.max_note_size) {
		return errorResponse(
			`Status must be less than ${config.validation.max_note_size} characters`,
			400
		);
	}

	// Validate media_ids
	if (media_ids && !Array.isArray(media_ids)) {
		return errorResponse("Media IDs must be an array", 422);
	}

	// Validate poll options
	if (options && !Array.isArray(options)) {
		return errorResponse("Poll options must be an array", 422);
	}

	if (options && options.length > 4) {
		return errorResponse("Poll options must be less than 5", 422);
	}

	// Validate poll expires_in
	if (expires_in && (expires_in < 60 || expires_in > 604800)) {
		return errorResponse(
			"Poll expires_in must be between 60 and 604800",
			422
		);
	}

	// Validate visibility
	if (
		visibility &&
		!["public", "unlisted", "private", "direct"].includes(visibility)
	) {
		return errorResponse("Invalid visibility", 422);
	}

	// Create status
	const newStatus = await Status.createNew({
		account: user,
		application,
		content: status,
		visibility:
			visibility ||
			(config.defaults.visibility as
				| "public"
				| "unlisted"
				| "private"
				| "direct"),
		sensitive: sensitive || false,
		spoiler_text: spoiler_text || "",
		emojis: [],
	});

	// TODO: add database jobs to deliver the post

	return jsonResponse(await newStatus.toAPI());
};
