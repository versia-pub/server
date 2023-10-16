import data from "../config/config.toml";

export interface ConfigType {
	database: {
		host: string;
		port: number;
		username: string;
		password: string;
		database: string;
	};

	http: {
		base_url: string;
		bind: string;
		bind_port: string;
		banned_ips: string[];
	};

	validation: {
		max_displayname_size: number;
		max_bio_size: number;
		max_username_size: number;
		max_note_size: number;
		max_avatar_size: number;
		max_header_size: number;
		max_media_size: number;
		max_media_attachments: number;
		max_media_description_size: number;

		username_blacklist: string[];
		blacklist_tempmail: boolean;
		email_blacklist: string[];
		url_scheme_whitelist: string[];

		allowed_mime_types: string[];
	};

	defaults: {
		visibility: string;
		language: string;
		avatar: string;
		header: string;
	};

	activitypub: {
		use_tombstones: boolean;
		reject_activities: string[];
		force_followers_only: string[];
		discard_reports: string[];
		discard_deletes: string[];
		discard_banners: string[];
		discard_avatars: string[];
		discard_updates: string[];
		discard_follows: string[];
		force_sensitive: string[];
		remove_media: string[];
		fetch_all_colletion_members: boolean;
	};

	filters: {
		note_filters: string[];
		username_filters: string[];
		displayname_filters: string[];
		bio_filters: string[];
		emoji_filters: string[];
	};

	logging: {
		log_requests: boolean;
		log_requests_verbose: boolean;
		log_filters: boolean;
	};

	ratelimits: {
		duration_coeff: number;
		max_coeff: number;
	};

	custom_ratelimits: Record<
		string,
		{
			duration: number;
			max: number;
		}
	>;
	[key: string]: unknown;
}

export const configDefaults: ConfigType = {
	http: {
		bind: "http://0.0.0.0",
		bind_port: "8000",
		base_url: "http://fediproject.localhost:8000",
		banned_ips: [],
	},
	database: {
		host: "localhost",
		port: 5432,
		username: "postgres",
		password: "postgres",
		database: "lysand",
	},
	validation: {
		max_displayname_size: 50,
		max_bio_size: 6000,
		max_note_size: 5000,
		max_avatar_size: 5_000_000,
		max_header_size: 5_000_000,
		max_media_size: 40_000_000,
		max_media_attachments: 4,
		max_media_description_size: 1000,
		max_username_size: 30,

		username_blacklist: [
			".well-known",
			"~",
			"about",
			"activities",
			"api",
			"auth",
			"dev",
			"inbox",
			"internal",
			"main",
			"media",
			"nodeinfo",
			"notice",
			"oauth",
			"objects",
			"proxy",
			"push",
			"registration",
			"relay",
			"settings",
			"status",
			"tag",
			"users",
			"web",
			"search",
			"mfa",
		],

		blacklist_tempmail: false,

		email_blacklist: [],

		url_scheme_whitelist: [
			"http",
			"https",
			"ftp",
			"dat",
			"dweb",
			"gopher",
			"hyper",
			"ipfs",
			"ipns",
			"irc",
			"xmpp",
			"ircs",
			"magnet",
			"mailto",
			"mumble",
			"ssb",
		],

		allowed_mime_types: [],
	},
	defaults: {
		visibility: "public",
		language: "en",
		avatar: "",
		header: "",
	},
	activitypub: {
		use_tombstones: true,
		reject_activities: [],
		force_followers_only: [],
		discard_reports: [],
		discard_deletes: [],
		discard_banners: [],
		discard_avatars: [],
		force_sensitive: [],
		discard_updates: [],
		discard_follows: [],
		remove_media: [],
		fetch_all_colletion_members: false,
	},
	filters: {
		note_filters: [],
		username_filters: [],
		displayname_filters: [],
		bio_filters: [],
		emoji_filters: [],
	},
	logging: {
		log_requests: false,
		log_requests_verbose: false,
		log_filters: true,
	},
	ratelimits: {
		duration_coeff: 1,
		max_coeff: 1,
	},
	custom_ratelimits: {},
};

export const getConfig = () => {
	return {
		...configDefaults,
		...(data as ConfigType),
	};
};

export const getHost = () => {
	const url = new URL(getConfig().http.base_url);

	return url.host;
};
