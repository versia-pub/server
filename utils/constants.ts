import { config } from "~/packages/config-manager/index.ts";

export const localObjectUri = (id: string): URL =>
    new URL(`/objects/${id}`, config.http.base_url);
