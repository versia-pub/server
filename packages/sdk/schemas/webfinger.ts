import { z } from "zod/v4";
import { url } from "./common.ts";

export const WebFingerSchema = z.object({
    subject: url,
    aliases: z.array(url).optional(),
    properties: z.record(url, z.string().or(z.null())).optional(),
    links: z
        .array(
            z.object({
                rel: z.string(),
                type: z.string().optional(),
                href: url.optional(),
                titles: z.record(z.string(), z.string()).optional(),
                properties: z.record(url, z.string().or(z.null())).optional(),
            }),
        )
        .optional(),
});
