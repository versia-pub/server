import data from "../config/config.toml";

export type ConfigType = {
	database: {
		host: string;
		port: number;
		username: string;
		password: string;
		database: string;
	}
	[ key: string ]: any;
}

export const getConfig = () => {
	return data as ConfigType;
}