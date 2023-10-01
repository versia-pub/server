import { getConfig } from "@config";
import { jsonResponse } from "@response";
import { Status } from "~database/entities/Status";
import { User } from "~database/entities/User";

/**
 * Creates a new user
 */
// eslint-disable-next-line @typescript-eslint/require-await
export default async (): Promise<Response> => {
	const config = getConfig();

	const statusCount = await Status.count();
	const userCount = await User.count();

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
		version: "0.0.1",
		max_toot_chars: config.validation.max_note_size,
	});
};
