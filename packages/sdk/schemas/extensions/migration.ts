import { z } from "zod";
import { url } from "../common.ts";
import { EntitySchema } from "../entity.ts";

export const MigrationSchema = EntitySchema.extend({
    type: z.literal("pub.versia:migration/Migration"),
    uri: z.null().optional(),
    author: url,
    destination: url,
});

export const MigrationExtensionSchema = z.strictObject({
    previous: url,
    new: url.nullish(),
});
