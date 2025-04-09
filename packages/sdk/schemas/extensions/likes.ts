import { z } from "zod";
import { url } from "../common.ts";
import { EntitySchema } from "../entity.ts";

export const LikeSchema = EntitySchema.extend({
    type: z.literal("pub.versia:likes/Like"),
    author: url,
    liked: url,
});

export const DislikeSchema = EntitySchema.extend({
    type: z.literal("pub.versia:likes/Dislike"),
    author: url,
    disliked: url,
});
