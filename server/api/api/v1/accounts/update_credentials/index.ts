import { getConfig } from "@config";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { User } from "~database/entities/User";
import { applyConfig } from "@api";

export const meta = applyConfig({
	allowedMethods: ["PATCH"],
	route: "/api/v1/accounts/update_credentials",
	ratelimits: {
		max: 2,
		duration: 60,
	},
	auth: {
		required: true,
	},
});

/**
 * Patches a user
 */
export default async (req: Request): Promise<Response> => {
	const { user } = await User.getFromRequest(req);

	if (!user) return errorResponse("Unauthorized", 401);

	const config = getConfig();

	const {
		display_name,
		note,
		avatar,
		header,
		locked,
		bot,
		discoverable,
		"source[privacy]": source_privacy,
		"source[sensitive]": source_sensitive,
		"source[language]": source_language,
	} = await parseRequest<{
		display_name: string;
		note: string;
		avatar: File;
		header: File;
		locked: string;
		bot: string;
		discoverable: string;
		"source[privacy]": string;
		"source[sensitive]": string;
		"source[language]": string;
	}>(req);

	if (display_name) {
		// Check if within allowed display name lengths
		if (
			display_name.length < 3 ||
			display_name.length > config.validation.max_displayname_size
		) {
			return errorResponse(
				`Display name must be between 3 and ${config.validation.max_displayname_size} characters`,
				422
			);
		}

		// Check if display name doesnt match filters
		if (
			config.filters.displayname_filters.some(filter =>
				display_name.match(filter)
			)
		) {
			return errorResponse("Display name contains blocked words", 422);
		}

		user.actor.data.name = display_name;
		user.display_name = display_name;
	}

	if (note) {
		// Check if within allowed note length
		if (note.length > config.validation.max_note_size) {
			return errorResponse(
				`Note must be less than ${config.validation.max_note_size} characters`,
				422
			);
		}

		// Check if bio doesnt match filters
		if (config.filters.bio_filters.some(filter => note.match(filter))) {
			return errorResponse("Bio contains blocked words", 422);
		}

		user.actor.data.summary = note;
		user.note = note;
	}

	if (source_privacy) {
		// Check if within allowed privacy values
		if (
			!["public", "unlisted", "private", "direct"].includes(
				source_privacy
			)
		) {
			return errorResponse(
				"Privacy must be one of public, unlisted, private, or direct",
				422
			);
		}

		user.source.privacy = source_privacy;
	}

	if (source_sensitive) {
		// Check if within allowed sensitive values
		if (source_sensitive !== "true" && source_sensitive !== "false") {
			return errorResponse("Sensitive must be a boolean", 422);
		}

		user.source.sensitive = source_sensitive === "true";
	}

	if (source_language) {
		// TODO: Check if proper ISO code
		user.source.language = source_language;
	}

	if (avatar) {
		// Check if within allowed avatar length (avatar is an image)
		if (avatar.size > config.validation.max_avatar_size) {
			return errorResponse(
				`Avatar must be less than ${config.validation.max_avatar_size} bytes`,
				422
			);
		}

		// TODO: Store the file somewhere and then change the user's actual avatar
	}

	if (header) {
		// Check if within allowed header length (header is an image)
		if (header.size > config.validation.max_header_size) {
			return errorResponse(
				`Header must be less than ${config.validation.max_avatar_size} bytes`,
				422
			);
		}
		// TODO: Store the file somewhere and then change the user's actual header
	}

	if (locked) {
		// Check if locked is a boolean
		if (locked !== "true" && locked !== "false") {
			return errorResponse("Locked must be a boolean", 422);
		}

		// TODO: Add a user value for Locked
		// user.locked = locked === "true";
	}

	if (bot) {
		// Check if bot is a boolean
		if (bot !== "true" && bot !== "false") {
			return errorResponse("Bot must be a boolean", 422);
		}

		// TODO: Add a user value for bot
		// user.bot = bot === "true";
	}

	if (discoverable) {
		// Check if discoverable is a boolean
		if (discoverable !== "true" && discoverable !== "false") {
			return errorResponse("Discoverable must be a boolean", 422);
		}

		// TODO: Add a user value for discoverable
		// user.discoverable = discoverable === "true";
	}

	await user.save();

	return jsonResponse(await user.toAPI());
};
