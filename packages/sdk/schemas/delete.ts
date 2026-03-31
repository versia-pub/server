import { z } from "zod";
import { ReferenceSchema, TransientEntitySchema } from "./entity.ts";

export const DeleteSchema = TransientEntitySchema.extend({
    type: z.literal("Delete"),
    author: ReferenceSchema,
    deleted_type: z.string(),
    deleted: ReferenceSchema,
});
