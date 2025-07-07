import { z } from "zod/v4";
import { url } from "../common.ts";
import { EntitySchema } from "../entity.ts";

export const ReportSchema = EntitySchema.extend({
    type: z.literal("pub.versia:reports/Report"),
    uri: z.null().optional(),
    author: url.nullish(),
    reported: z.array(url),
    tags: z.array(z.string()),
    comment: z
        .string()
        .max(2 ** 16)
        .nullish(),
});
