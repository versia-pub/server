import { getConfig } from "~classes/configmanager";

const config = getConfig();

export const oauthRedirectUri = (issuer: string) =>
	`${config.http.base_url}/oauth/callback/${issuer}`;
