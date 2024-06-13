import { MediaBackendType } from "media-manager";
import type { Config } from "~/packages/config-manager";

export const getUrl = (name: string, config: Config) => {
    if (config.media.backend === MediaBackendType.LOCAL) {
        return new URL(`/media/${name}`, config.http.base_url).toString();
    }
    if (config.media.backend === MediaBackendType.S3) {
        return new URL(`/${name}`, config.s3.public_url).toString();
    }
    return "";
};
