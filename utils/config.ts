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
	[key: string]: unknown;
}

export const getConfig = () => {
	return data as ConfigType;
};

export const getHost = () => {
	const url = new URL(getConfig().http.base_url);

	return url.host;
};
