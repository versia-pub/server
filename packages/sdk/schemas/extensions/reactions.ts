import { z } from "zod";
import { EntitySchema, ReferenceSchema } from "../entity.ts";

export const ReactionSchema = EntitySchema.extend({
    type: z.literal("pub.versia:reactions/Reaction"),
    author: ReferenceSchema,
    object: ReferenceSchema,
    content: z.string().min(1).max(256),
});
