import { z } from "zod";
import { EntitySchema, ReferenceSchema } from "../entity.ts";

export const LikeSchema = EntitySchema.extend({
    type: z.literal("pub.versia:likes/Like"),
    author: ReferenceSchema,
    liked: ReferenceSchema,
});

export const DislikeSchema = EntitySchema.extend({
    type: z.literal("pub.versia:likes/Dislike"),
    author: ReferenceSchema,
    disliked: ReferenceSchema,
});
