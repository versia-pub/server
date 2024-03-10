import { errorResponse, jsonResponse } from "@response";
import { userRelations, userToAPI } from "~database/entities/User";
import { apiRoute, applyConfig } from "@api";
import { sanitize } from "isomorphic-dompurify";
import { sanitizeHtml } from "@sanitization";
import { uploadFile } from "~classes/media";
import ISO6391 from "iso-639-1";
import { parseEmojis } from "~database/entities/Emoji";
import { client } from "~database/datasource";
import type { APISource } from "~types/entities/source";
import { convertTextToHtml } from "@formatting";

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

export default apiRoute<{
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
}>(async (req, matchedRoute, extraData) => {
	const { user } = extraData.auth;

	if (!user) return errorResponse("Unauthorized", 401);

	const config = await extraData.configManager.getConfig();

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
	} = extraData.parsedRequest;

	const sanitizedNote = await sanitizeHtml(note ?? "");

	const sanitizedDisplayName = sanitize(display_name ?? "", {
		ALLOWED_TAGS: [],
		ALLOWED_ATTR: [],
	});

	if (!user.source) {
		user.source = {
			privacy: "public",
			sensitive: false,
			language: "en",
			note: "",
		};
	}

	if (display_name) {
		// Check if within allowed display name lengths
		if (
			sanitizedDisplayName.length < 3 ||
			sanitizedDisplayName.length > config.validation.max_displayname_size
		) {
			return errorResponse(
				`Display name must be between 3 and ${config.validation.max_displayname_size} characters`,
				422
			);
		}

		// Check if display name doesnt match filters
		if (
			config.filters.displayname_filters.some(filter =>
				sanitizedDisplayName.match(filter)
			)
		) {
			return errorResponse("Display name contains blocked words", 422);
		}

		// Remove emojis
		user.emojis = [];

		user.displayName = sanitizedDisplayName;
	}

	if (note && user.source) {
		// Check if within allowed note length
		if (sanitizedNote.length > config.validation.max_note_size) {
			return errorResponse(
				`Note must be less than ${config.validation.max_note_size} characters`,
				422
			);
		}

		// Check if bio doesnt match filters
		if (
			config.filters.bio_filters.some(filter =>
				sanitizedNote.match(filter)
			)
		) {
			return errorResponse("Bio contains blocked words", 422);
		}

		(user.source as unknown as APISource).note = sanitizedNote;
		// TODO: Convert note to HTML
		user.note = await convertTextToHtml(sanitizedNote);
	}

	if (source_privacy && user.source) {
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

		// @ts-expect-error Prisma Typescript doesn't include relations
		user.source.privacy = source_privacy;
	}

	if (source_sensitive && user.source) {
		// Check if within allowed sensitive values
		if (source_sensitive !== "true" && source_sensitive !== "false") {
			return errorResponse("Sensitive must be a boolean", 422);
		}

		// @ts-expect-error Prisma Typescript doesn't include relations
		user.source.sensitive = source_sensitive === "true";
	}

	if (source_language && user.source) {
		if (!ISO6391.validate(source_language)) {
			return errorResponse(
				"Language must be a valid ISO 639-1 code",
				422
			);
		}

		// @ts-expect-error Prisma Typescript doesn't include relations
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

		const hash = await uploadFile(avatar, config);

		user.avatar = hash || "";
	}

	if (header) {
		// Check if within allowed header length (header is an image)
		if (header.size > config.validation.max_header_size) {
			return errorResponse(
				`Header must be less than ${config.validation.max_avatar_size} bytes`,
				422
			);
		}

		const hash = await uploadFile(header, config);

		user.header = hash || "";
	}

	if (locked) {
		// Check if locked is a boolean
		if (locked !== "true" && locked !== "false") {
			return errorResponse("Locked must be a boolean", 422);
		}

		user.isLocked = locked === "true";
	}

	if (bot) {
		// Check if bot is a boolean
		if (bot !== "true" && bot !== "false") {
			return errorResponse("Bot must be a boolean", 422);
		}

		user.isBot = bot === "true";
	}

	if (discoverable) {
		// Check if discoverable is a boolean
		if (discoverable !== "true" && discoverable !== "false") {
			return errorResponse("Discoverable must be a boolean", 422);
		}

		user.isDiscoverable = discoverable === "true";
	}

	// Parse emojis

	const displaynameEmojis = await parseEmojis(sanitizedDisplayName);
	const noteEmojis = await parseEmojis(sanitizedNote);

	user.emojis = [...displaynameEmojis, ...noteEmojis];

	// Deduplicate emojis
	user.emojis = user.emojis.filter(
		(emoji, index, self) => self.findIndex(e => e.id === emoji.id) === index
	);

	const output = await client.user.update({
		where: { id: user.id },
		data: {
			displayName: user.displayName,
			note: user.note,
			avatar: user.avatar,
			header: user.header,
			isLocked: user.isLocked,
			isBot: user.isBot,
			isDiscoverable: user.isDiscoverable,
			emojis: {
				disconnect: user.emojis.map(e => ({
					id: e.id,
				})),
				connect: user.emojis.map(e => ({
					id: e.id,
				})),
			},
			source: user.source || undefined,
		},
		include: userRelations,
	});

	return jsonResponse(userToAPI(output));
});
