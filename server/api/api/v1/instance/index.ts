import { applyConfig } from "@api";
import { getConfig } from "@config";
import { jsonResponse } from "@response";
import { Status } from "~database/entities/Status";
import { UserAction } from "~database/entities/User";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/instance",
	ratelimits: {
		max: 300,
		duration: 60,
	},
	auth: {
		required: false,
	},
});

/**
 * Creates a new user
 */
// eslint-disable-next-line @typescript-eslint/require-await
export default async (): Promise<Response> => {
	const config = getConfig();

	const statusCount = await Status.count();
	const userCount = await UserAction.count();

	// TODO: fill in more values
	return jsonResponse({
		approval_required: false,
		configuration: {
			media_attachments: {
				image_matrix_limit: 10,
				image_size_limit: config.validation.max_media_size,
				supported_mime_types: config.validation.allowed_mime_types,
				video_frame_limit: 60,
				video_matrix_limit: 10,
				video_size_limit: config.validation.max_media_size,
			},
			polls: {
				max_characters_per_option: 100,
				max_expiration: 60 * 60 * 24 * 365 * 100, // 100 years,
				max_options: 40,
				min_expiration: 60,
			},
			statuses: {
				characters_reserved_per_url: 0,
				max_characters: config.validation.max_note_size,
				max_media_attachments: config.validation.max_media_attachments,
				supported_mime_types: [
					"text/plain",
					"text/markdown",
					"text/html",
					"text/x.misskeymarkdown",
				],
			},
		},
		description: "A test instance",
		email: "",
		invites_enabled: false,
		registrations: true,
		languages: ["en"],
		rules: [],
		stats: {
			domain_count: 1,
			status_count: statusCount,
			user_count: userCount,
		},
		thumbnail: "",
		title: "Test Instance",
		uri: new URL(config.http.base_url).hostname,
		urls: {
			streaming_api: "",
		},
		version: "4.2.0+glitch (compatible; Lysand 0.0.1)",
		max_toot_chars: config.validation.max_note_size,
		pleroma: {
			metadata: {
				// account_activation_required: false,
				features: [
					"pleroma_api",
					"akkoma_api",
					"mastodon_api",
					// "mastodon_api_streaming",
					// "polls",
					// "v2_suggestions",
					// "pleroma_explicit_addressing",
					// "shareable_emoji_packs",
					// "multifetch",
					// "pleroma:api/v1/notifications:include_types_filter",
					"quote_posting",
					"editing",
					// "bubble_timeline",
					// "relay",
					// "pleroma_emoji_reactions",
					// "exposable_reactions",
					// "profile_directory",
					// "custom_emoji_reactions",
					// "pleroma:get:main/ostatus",
				],
				post_formats: [
					"text/plain",
					"text/html",
					"text/markdown",
					"text/x.misskeymarkdown",
				],
				privileged_staff: false,
			},
			stats: {
				mau: 2,
			},
		},
	});
};
