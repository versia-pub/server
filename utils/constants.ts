import { config } from "config-manager";

export const oauthRedirectUri = (issuer: string) =>
    new URL(`/oauth/sso/${issuer}/callback`, config.http.base_url).toString();
