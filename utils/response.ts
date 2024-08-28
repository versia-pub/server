import { config } from "~/packages/config-manager";

export type Json =
    | string
    | number
    | boolean
    | null
    | undefined
    | Json[]
    | { [key: string]: Json };

export const proxyUrl = (url: string | null = null) => {
    const urlAsBase64Url = Buffer.from(url || "").toString("base64url");
    return url
        ? new URL(
              `/media/proxy/${urlAsBase64Url}`,
              config.http.base_url,
          ).toString()
        : url;
};
