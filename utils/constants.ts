import { config } from "config-manager";

export const oauthRedirectUri = (issuer: string) =>
    new URL(`/oauth/callback/${issuer}`, config.http.base_url).toString();
