import { z } from "zod/v4";
import { url } from "./common.ts";
import { EntitySchema } from "./entity.ts";

export const FollowSchema = EntitySchema.extend({
    type: z.literal("Follow"),
    uri: z.null().optional(),
    author: url,
    followee: url,
});

export const FollowAcceptSchema = EntitySchema.extend({
    type: z.literal("FollowAccept"),
    uri: z.null().optional(),
    author: url,
    follower: url,
});

export const FollowRejectSchema = EntitySchema.extend({
    type: z.literal("FollowReject"),
    uri: z.null().optional(),
    author: url,
    follower: url,
});

export const UnfollowSchema = EntitySchema.extend({
    type: z.literal("Unfollow"),
    uri: z.null().optional(),
    author: url,
    followee: url,
});
