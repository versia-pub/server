import { config } from "config-manager";

export const oauthRedirectUri = (issuer: string) =>
    new URL(`/oauth/sso/${issuer}/callback`, config.http.base_url).toString();

export const localObjectUri = (id: string) =>
    new URL(`/objects/${id}`, config.http.base_url).toString();
