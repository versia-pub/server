import { z } from "zod";
import { ReferenceSchema, TransientEntitySchema } from "./entity.ts";

export const FollowSchema = TransientEntitySchema.extend({
    type: z.literal("Follow"),
    author: ReferenceSchema,
    followee: ReferenceSchema,
});

export const FollowAcceptSchema = TransientEntitySchema.extend({
    type: z.literal("FollowAccept"),
    author: ReferenceSchema,
    follower: ReferenceSchema,
});

export const FollowRejectSchema = TransientEntitySchema.extend({
    type: z.literal("FollowReject"),
    author: ReferenceSchema,
    follower: ReferenceSchema,
});

export const UnfollowSchema = TransientEntitySchema.extend({
    type: z.literal("Unfollow"),
    author: ReferenceSchema,
    followee: ReferenceSchema,
});
