import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { sanitizeHtml } from "@sanitization";
import { parse } from "marked";
import { client } from "~database/datasource";
import { getFromToken } from "~database/entities/Application";
import type { StatusWithRelations } from "~database/entities/Status";
import { createNewStatus, statusToAPI } from "~database/entities/Status";
import type { UserWithRelations } from "~database/entities/User";
import { statusAndUserRelations } from "~database/entities/relations";

export const meta = applyConfig({
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
export default apiRoute<{
	status: string;
	media_ids?: string[];
	"poll[options]"?: string[];
	"poll[expires_in]"?: number;
	"poll[multiple]"?: boolean;
	"poll[hide_totals]"?: boolean;
	in_reply_to_id?: string;
	quote_id?: string;
	sensitive?: boolean;
	spoiler_text?: string;
	visibility?: "public" | "unlisted" | "private" | "direct";
	language?: string;
	scheduled_at?: string;
	local_only?: boolean;
	content_type?: string;
}>(async (req, matchedRoute, extraData) => {
	const { user, token } = extraData.auth;
	const application = await getFromToken(token);

	if (!user) return errorResponse("Unauthorized", 401);

	const config = await extraData.configManager.getConfig();

	const {
		status,
		media_ids,
		"poll[expires_in]": expires_in,
		// "poll[hide_totals]": hide_totals,
		// "poll[multiple]": multiple,
		"poll[options]": options,
		in_reply_to_id,
		quote_id,
		// language,
		scheduled_at,
		sensitive,
		spoiler_text,
		visibility,
		content_type,
	} = extraData.parsedRequest;

	// Validate status
	if (!status && !(media_ids && media_ids.length > 0)) {
		return errorResponse(
			"Status is required unless media is attached",
			422
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

	if (media_ids && media_ids.length > 0) {
		// Disallow poll
		if (options) {
			return errorResponse("Cannot attach poll to media", 422);
		}
		if (media_ids.length > 4) {
			return errorResponse("Media IDs must be less than 5", 422);
		}
	}

	if (options && options.length > config.validation.max_poll_options) {
		return errorResponse(
			`Poll options must be less than ${config.validation.max_poll_options}`,
			422
		);
	}

	if (
		options &&
		options.some(
			option => option.length > config.validation.max_poll_option_size
		)
	) {
		return errorResponse(
			`Poll options must be less than ${config.validation.max_poll_option_size} characters`,
			422
		);
	}

	if (expires_in && expires_in < config.validation.min_poll_duration) {
		return errorResponse(
			`Poll duration must be greater than ${config.validation.min_poll_duration} seconds`,
			422
		);
	}

	if (expires_in && expires_in > config.validation.max_poll_duration) {
		return errorResponse(
			`Poll duration must be less than ${config.validation.max_poll_duration} seconds`,
			422
		);
	}

	if (scheduled_at) {
		if (new Date(scheduled_at).getTime() < Date.now()) {
			return errorResponse("Scheduled time must be in the future", 422);
		}
	}

	let sanitizedStatus: string;

	if (content_type === "text/markdown") {
		sanitizedStatus = await sanitizeHtml(parse(status ?? "") as any);
	} else if (content_type === "text/x.misskeymarkdown") {
		// Parse as MFM
		// TODO: Parse as MFM
		sanitizedStatus = await sanitizeHtml(parse(status ?? "") as any);
	} else {
		sanitizedStatus = await sanitizeHtml(status ?? "");
	}

	if (sanitizedStatus.length > config.validation.max_note_size) {
		return errorResponse(
			`Status must be less than ${config.validation.max_note_size} characters`,
			400
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
	let replyStatus: StatusWithRelations | null = null;
	let replyUser: UserWithRelations | null = null;
	let quote: StatusWithRelations | null = null;

	if (in_reply_to_id) {
		replyStatus = await client.status.findUnique({
			where: { id: in_reply_to_id },
			include: statusAndUserRelations,
		});

		if (!replyStatus) {
			return errorResponse("Reply status not found", 404);
		}

		// @ts-expect-error Prisma Typescript doesn't include relations
		replyUser = replyStatus.author;
	}

	if (quote_id) {
		quote = await client.status.findUnique({
			where: { id: quote_id },
			include: statusAndUserRelations,
		});

		if (!quote) {
			return errorResponse("Quote status not found", 404);
		}
	}

	// Check if status body doesnt match filters
	if (config.filters.note_filters.some(filter => status?.match(filter))) {
		return errorResponse("Status contains blocked words", 422);
	}

	// Check if media attachments are all valid

	const foundAttachments = await client.attachment.findMany({
		where: {
			id: {
				in: media_ids ?? [],
			},
		},
	});

	if (foundAttachments.length !== (media_ids ?? []).length) {
		return errorResponse("Invalid media IDs", 422);
	}

	const newStatus = await createNewStatus({
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
		media_attachments: media_ids,
		reply:
			replyStatus && replyUser
				? {
						user: replyUser,
						status: replyStatus,
					}
				: undefined,
		quote: quote || undefined,
	});

	// TODO: add database jobs to deliver the post

	return jsonResponse(await statusToAPI(newStatus, user));
});
