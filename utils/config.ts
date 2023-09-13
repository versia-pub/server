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
		port: number;
		base_url: string;
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
	};
	[key: string]: unknown;
}

export const getConfig = () => {
	return data as ConfigType;
};

export const getHost = () => {
	const url = new URL(getConfig().http.base_url);

	return url.host;
};
