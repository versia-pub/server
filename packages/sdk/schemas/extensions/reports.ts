import { z } from "zod";
import { ReferenceSchema, TransientEntitySchema } from "../entity.ts";

export const ReportSchema = TransientEntitySchema.extend({
    type: z.literal("pub.versia:reports/Report"),
    author: ReferenceSchema.nullish(),
    reported: z.array(ReferenceSchema),
    tags: z.array(z.string()),
    comment: z
        .string()
        .max(2 ** 16)
        .nullish(),
});
