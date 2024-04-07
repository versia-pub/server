import { config } from "config-manager";

export const oauthRedirectUri = (issuer: string) =>
    `${config.http.base_url}/oauth/callback/${issuer}`;
