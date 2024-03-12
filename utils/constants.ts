import { ConfigManager } from "config-manager";

const config = await new ConfigManager({}).getConfig();

export const oauthRedirectUri = (issuer: string) =>
	`${config.http.base_url}/oauth/callback/${issuer}`;
