import { z } from "zod/v4";
import { url } from "../common.ts";
import { EntitySchema } from "../entity.ts";

export const ReactionSchema = EntitySchema.extend({
    type: z.literal("pub.versia:reactions/Reaction"),
    author: url,
    object: url,
    content: z.string().min(1).max(256),
});
