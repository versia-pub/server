import { getUserByToken } from "@auth";
import { getConfig } from "@config";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";

/**
 * Patches a user
 */
export default async (req: Request): Promise<Response> => {
	// Check if request is a PATCH request
	if (req.method !== "PATCH")
		return errorResponse("This method requires a PATCH request", 405);

	// Check auth token
	const token = req.headers.get("Authorization")?.split(" ")[1] || null;

	if (!token)
		return errorResponse("This method requires an authenticated user", 422);

	const user = await getUserByToken(token);

	if (!user) return errorResponse("Unauthorized", 401);

	const config = getConfig();

	const { display_name, note, avatar, header, locked, bot, discoverable } =
		await parseRequest<{
			display_name: string;
			note: string;
			avatar: File;
			header: File;
			locked: string;
			bot: string;
			discoverable: string;
		}>(req);

	// TODO: Implement other options like field or source
	// const source_privacy = body.get("source[privacy]")?.toString() || null;
	// const source_sensitive = body.get("source[sensitive]")?.toString() || null;
	// const source_language = body.get("source[language]")?.toString() || null;

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

		user.note = note;
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

	return jsonResponse(
		{
			error: `Not really implemented yet`,
		},
		501
	);
};
