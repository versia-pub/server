import { config } from "~/config.ts";

export const localObjectUri = (id: string): URL =>
    new URL(`/objects/${id}`, config.http.base_url);
