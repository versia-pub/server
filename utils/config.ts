import data from "../config/config.toml";

export interface ConfigType {
	database: {
		host: string;
		port: number;
		username: string;
		password: string;
		database: string;
	}
	[ key: string ]: unknown;
}

export const getConfig = () => {
	return data as ConfigType;
}