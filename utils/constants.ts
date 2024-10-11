import { config } from "~/packages/config-manager/index.ts";

export const localObjectUri = (id: string) =>
    new URL(`/objects/${id}`, config.http.base_url).toString();
