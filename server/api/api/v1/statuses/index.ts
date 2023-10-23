/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { applyConfig } from "@api";
import { getConfig } from "@config";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { sanitizeHtml } from "@sanitization";
import { APActor } from "activitypub-types";
import { sanitize } from "isomorphic-dompurify";
import { parse } from "marked";
import { Application } from "~database/entities/Application";
import { RawObject } from "~database/entities/RawObject";
import { Status, statusRelations } from "~database/entities/Status";
import { User } from "~database/entities/User";
import { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 300,
		duration: 60,
	},
	route: "/api/v1/statuses",
	auth: {
		required: true,
	},
});

/**
 * Post new status
 */
export default async (req: Request): Promise<Response> => {
	const { user, token } = await User.getFromRequest(req);
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
		content_type,
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
		local_only?: boolean;
		content_type?: string;
	}>(req);

	// Validate status
	if (!status) {
		return errorResponse("Status is required", 422);
	}

	let sanitizedStatus: string;

	if (content_type === "text/markdown") {
		sanitizedStatus = await sanitizeHtml(parse(status));
	} else if (content_type === "text/x.misskeymarkdown") {
		// Parse as MFM
		// TODO: Parse as MFM
		sanitizedStatus = await sanitizeHtml(parse(status));
	} else {
		sanitizedStatus = await sanitizeHtml(status);
	}

	if (sanitizedStatus.length > config.validation.max_note_size) {
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

	// Get reply account and status if exists
	let replyStatus: Status | null = null;
	let replyUser: User | null = null;

	if (in_reply_to_id) {
		replyStatus = await Status.findOne({
			where: {
				id: in_reply_to_id,
			},
			relations: statusRelations,
		});

		replyUser = replyStatus?.account || null;
	}

	// Check if status body doesnt match filters
	if (config.filters.note_filters.some(filter => status.match(filter))) {
		return errorResponse("Status contains blocked words", 422);
	}

	// Create status
	const newStatus = await Status.createNew({
		account: user,
		application,
		content: sanitizedStatus,
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
		reply:
			replyStatus && replyUser
				? {
						user: replyUser,
						status: replyStatus,
				  }
				: undefined,
	});

	// TODO: add database jobs to deliver the post

	return jsonResponse(await newStatus.toAPI());
};
