import { z } from "zod";
import { ReferenceSchema, TransientEntitySchema } from "../entity.ts";

export const MigrationSchema = TransientEntitySchema.extend({
    type: z.literal("pub.versia:migration/Migration"),
    author: ReferenceSchema,
    destination: ReferenceSchema,
});

export const MigrationExtensionSchema = z.strictObject({
    previous: ReferenceSchema,
    new: ReferenceSchema.nullish(),
});
