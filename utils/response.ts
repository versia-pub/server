import { config } from "~/packages/config-manager";

export type Json =
    | string
    | number
    | boolean
    | null
    | undefined
    | Json[]
    | { [key: string]: Json };

export const proxyUrl = (url: URL): URL => {
    const urlAsBase64Url = Buffer.from(url.toString() || "").toString(
        "base64url",
    );
    return new URL(`/media/proxy/${urlAsBase64Url}`, config.http.base_url);
};
