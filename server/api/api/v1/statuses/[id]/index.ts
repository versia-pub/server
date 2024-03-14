import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { sanitizeHtml } from "@sanitization";
import { parse } from "marked";
import { client } from "~database/datasource";
import {
	editStatus,
	isViewableByUser,
	statusToAPI,
} from "~database/entities/Status";
import { statusAndUserRelations } from "~database/entities/relations";

export const meta = applyConfig({
	allowedMethods: ["GET", "DELETE", "PUT"],
	ratelimits: {
		max: 100,
		duration: 60,
	},
	route: "/api/v1/statuses/:id",
	auth: {
		required: false,
		requiredOnMethods: ["DELETE", "PUT"],
	},
});

/**
 * Fetch a user
 */
export default apiRoute<{
	status?: string;
	spoiler_text?: string;
	sensitive?: boolean;
	language?: string;
	content_type?: string;
	media_ids?: string[];
	"poll[options]"?: string[];
	"poll[expires_in]"?: number;
	"poll[multiple]"?: boolean;
	"poll[hide_totals]"?: boolean;
}>(async (req, matchedRoute, extraData) => {
	const id = matchedRoute.params.id;

	const { user } = extraData.auth;

	const status = await client.status.findUnique({
		where: { id },
		include: statusAndUserRelations,
	});

	const config = await extraData.configManager.getConfig();

	// Check if user is authorized to view this status (if it's private)
	if (!status || !isViewableByUser(status, user))
		return errorResponse("Record not found", 404);

	if (req.method === "GET") {
		return jsonResponse(await statusToAPI(status));
	} else if (req.method === "DELETE") {
		if (status.authorId !== user?.id) {
			return errorResponse("Unauthorized", 401);
		}

		// TODO: Implement delete and redraft functionality

		// Get associated Status object

		// Delete status and all associated objects
		await client.status.delete({
			where: { id },
		});

		return jsonResponse(
			{
				...(await statusToAPI(status, user)),
				// TODO: Add
				// text: Add source text
				// poll: Add source poll
				// media_attachments
			},
			200
		);
	} else if (req.method == "PUT") {
		if (status.authorId !== user?.id) {
			return errorResponse("Unauthorized", 401);
		}

		const {
			status: statusText,
			content_type,
			"poll[expires_in]": expires_in,
			"poll[options]": options,
			media_ids: media_ids,
			spoiler_text,
			sensitive,
		} = extraData.parsedRequest;

		// TODO: Add Poll support
		// Validate status
		if (!statusText && !(media_ids && media_ids.length > 0)) {
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

		let sanitizedStatus: string;

		if (content_type === "text/markdown") {
			sanitizedStatus = await sanitizeHtml(await parse(statusText ?? ""));
		} else if (content_type === "text/x.misskeymarkdown") {
			// Parse as MFM
			// TODO: Parse as MFM
			sanitizedStatus = await sanitizeHtml(await parse(statusText ?? ""));
		} else {
			sanitizedStatus = await sanitizeHtml(statusText ?? "");
		}

		if (sanitizedStatus.length > config.validation.max_note_size) {
			return errorResponse(
				`Status must be less than ${config.validation.max_note_size} characters`,
				400
			);
		}

		// Check if status body doesnt match filters
		if (
			config.filters.note_filters.some(filter =>
				statusText?.match(filter)
			)
		) {
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

		// Update status
		const newStatus = await editStatus(status, {
			content: sanitizedStatus,
			content_type,
			media_attachments: media_ids,
			spoiler_text: spoiler_text ?? "",
			sensitive: sensitive ?? false,
		});

		return jsonResponse(await statusToAPI(newStatus, user));
	}

	return jsonResponse({});
});
