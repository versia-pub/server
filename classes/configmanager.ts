/**
 * @file configmanager.ts
 * @summary ConfigManager system to retrieve and modify system configuration
 * @description Can read from a hand-written file, config.toml, or from a machine-saved file, config.internal.toml
 * @deprecated Use the new ConfigManager class instead
 * Fuses both and provides a way to retrieve individual values
 */

/* import { parse, stringify } from "@iarna/toml";
import chalk from "chalk";
import merge from "merge-deep-ts";

const scanConfig = async () => {
	const config = Bun.file(process.cwd() + "/config/config.toml");

	if (!(await config.exists())) {
		console.error(
			`${chalk.red(`✗`)} ${chalk.bold(
				"Error while reading config: "
			)} Config file not found`
		);
		process.exit(1);
	}

	return parse(await config.text()) as ConfigType;
}; */

// Creates the internal config with nothing in it if it doesnt exist
/* const scanInternalConfig = async () => {
	const config = Bun.file(process.cwd() + "/config/config.internal.toml");

	if (!(await config.exists())) {
		await Bun.write(config, "");
	}

	return parse(await config.text()) as ConfigType;
};

let config = await scanConfig();
const internalConfig = await scanInternalConfig();

export interface ConfigType {
	database: {
		host: string;
		port: number;
		username: string;
		password: string;
		database: string;
	};

	redis: {
		queue: {
			host: string;
			port: number;
			password: string;
			database: number | null;
		};
		cache: {
			host: string;
			port: number;
			password: string;
			database: number | null;
			enabled: boolean;
		};
	};

	meilisearch: {
		host: string;
		port: number;
		api_key: string;
		enabled: boolean;
	};

	signups: {
		tos_url: string;
		rules: string[];
		registration: boolean;
	};

	oidc: {
		providers: {
			name: string;
			id: string;
			url: string;
			client_id: string;
			client_secret: string;
			icon: string;
		}[];
	};

	http: {
		base_url: string;
		bind: string;
		bind_port: string;
		banned_ips: string[];
		banned_user_agents: string[];
	};

	instance: {
		name: string;
		description: string;
		banner: string;
		logo: string;
	};

	smtp: {
		server: string;
		port: number;
		username: string;
		password: string;
		tls: boolean;
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
		max_poll_options: number;
		max_poll_option_size: number;
		min_poll_duration: number;
		max_poll_duration: number;

		username_blacklist: string[];
		blacklist_tempmail: boolean;
		email_blacklist: string[];
		url_scheme_whitelist: string[];

		enforce_mime_types: boolean;
		allowed_mime_types: string[];
	};

	media: {
		backend: string;
		deduplicate_media: boolean;
		conversion: {
			convert_images: boolean;
			convert_to: string;
		};
	};

	s3: {
		endpoint: string;
		access_key: string;
		secret_access_key: string;
		region: string;
		bucket_name: string;
		public_url: string;
	};

	defaults: {
		visibility: string;
		language: string;
		avatar: string;
		header: string;
	};

	email: {
		send_on_report: boolean;
		send_on_suspend: boolean;
		send_on_unsuspend: boolean;
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
		fetch_all_collection_members: boolean;
		authorized_fetch: boolean;
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
		base_url: "http://lysand.localhost:8000",
		banned_ips: [],
		banned_user_agents: [],
	},
	database: {
		host: "localhost",
		port: 5432,
		username: "postgres",
		password: "postgres",
		database: "lysand",
	},
	redis: {
		queue: {
			host: "localhost",
			port: 6379,
			password: "",
			database: 0,
		},
		cache: {
			host: "localhost",
			port: 6379,
			password: "",
			database: 1,
			enabled: false,
		},
	},
	meilisearch: {
		host: "localhost",
		port: 1491,
		api_key: "",
		enabled: false,
	},
	signups: {
		tos_url: "",
		rules: [],
		registration: false,
	},
	oidc: {
		providers: [],
	},
	instance: {
		banner: "",
		description: "",
		logo: "",
		name: "",
	},
	smtp: {
		password: "",
		port: 465,
		server: "",
		tls: true,
		username: "",
	},
	media: {
		backend: "local",
		deduplicate_media: true,
		conversion: {
			convert_images: false,
			convert_to: "webp",
		},
	},
	email: {
		send_on_report: false,
		send_on_suspend: false,
		send_on_unsuspend: false,
	},
	s3: {
		access_key: "",
		bucket_name: "",
		endpoint: "",
		public_url: "",
		region: "",
		secret_access_key: "",
	},
	validation: {
		max_displayname_size: 50,
		max_bio_size: 6000,
		max_note_size: 5000,
		max_avatar_size: 5_000_000,
		max_header_size: 5_000_000,
		max_media_size: 40_000_000,
		max_media_attachments: 10,
		max_media_description_size: 1000,
		max_poll_options: 20,
		max_poll_option_size: 500,
		min_poll_duration: 60,
		max_poll_duration: 1893456000,
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

		enforce_mime_types: false,
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
		fetch_all_collection_members: false,
		authorized_fetch: false,
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
}; */

/* export const getConfig = () => {
	// Deeply merge configDefaults, config and internalConfig
	return merge([configDefaults, config, internalConfig]) as any as ConfigType;
};
 */
/**
 * Sets the internal config
 * @param newConfig Any part of ConfigType
 */
/* export const setConfig = async (newConfig: Partial<ConfigType>) => {
	const newInternalConfig = merge([
		internalConfig,
		newConfig,
	]) as any as ConfigType;

	// Prepend a warning comment and write the new TOML to the file
	await Bun.write(
		Bun.file(process.cwd() + "/config/config.internal.toml"),
		`# This file is automatically generated. Do not modify it manually.\n${stringify(
			newInternalConfig as any
		)}`
	);
}; */

/* export const getHost = () => {
	const url = new URL(getConfig().http.base_url);

	return url.host;
};
 */
// Refresh config every 5 seconds
/* setInterval(() => {
	scanConfig()
		.then(newConfig => {
			if (newConfig !== config) {
				config = newConfig;
			}
		})
		.catch(e => {
			console.error(e);
		});
}, 5000); */

/* export { config };
 */
