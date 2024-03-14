import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";
import { client } from "~database/datasource";
import { userToAPI } from "~database/entities/User";
import type { APIInstance } from "~types/entities/instance";
import manifest from "~package.json";
import { userRelations } from "~database/entities/relations";

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

export default apiRoute(async (req, matchedRoute, extraData) => {
	const config = await extraData.configManager.getConfig();

	// Get software version from package.json
	const version = manifest.version;

	const statusCount = await client.status.count({
		where: {
			instanceId: null,
		},
	});
	const userCount = await client.user.count({
		where: {
			instanceId: null,
		},
	});

	// Get the first created admin user
	const contactAccount = await client.user.findFirst({
		where: {
			instanceId: null,
			isAdmin: true,
		},
		orderBy: {
			id: "asc",
		},
		include: userRelations,
	});

	// Get user that have posted once in the last 30 days
	const monthlyActiveUsers = await client.user.count({
		where: {
			instanceId: null,
			statuses: {
				some: {
					createdAt: {
						gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
					},
				},
			},
		},
	});

	const knownDomainsCount = await client.instance.count();

	// TODO: fill in more values
	return jsonResponse({
		approval_required: false,
		configuration: {
			media_attachments: {
				image_matrix_limit: config.validation.max_media_attachments,
				image_size_limit: config.validation.max_media_size,
				supported_mime_types: config.validation.allowed_mime_types,
				video_frame_limit: 60,
				video_matrix_limit: 10,
				video_size_limit: config.validation.max_media_size,
			},
			polls: {
				max_characters_per_option:
					config.validation.max_poll_option_size,
				max_expiration: config.validation.max_poll_duration,
				max_options: config.validation.max_poll_options,
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
		registrations: config.signups.registration,
		languages: ["en"],
		rules: config.signups.rules.map((r, index) => ({
			id: String(index),
			text: r,
		})),
		stats: {
			domain_count: knownDomainsCount,
			status_count: statusCount,
			user_count: userCount,
		},
		thumbnail: "",
		tos_url: config.signups.tos_url,
		title: "Test Instance",
		uri: new URL(config.http.base_url).hostname,
		urls: {
			streaming_api: "",
		},
		version: `4.2.0+glitch (compatible; Lysand ${version}})`,
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
				mau: monthlyActiveUsers,
			},
		},
		contact_account: contactAccount ? userToAPI(contactAccount) : null,
	} as APIInstance);
});
