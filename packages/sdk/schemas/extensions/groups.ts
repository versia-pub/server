import { z } from "zod/v4";
import { url } from "../common.ts";
import { TextContentFormatSchema } from "../contentformat.ts";
import { EntitySchema } from "../entity.ts";

export const GroupSchema = EntitySchema.extend({
    type: z.literal("pub.versia:groups/Group"),
    name: TextContentFormatSchema.nullish(),
    description: TextContentFormatSchema.nullish(),
    open: z.boolean().nullish(),
    members: url,
    notes: url.nullish(),
});

export const GroupSubscribeSchema = EntitySchema.extend({
    type: z.literal("pub.versia:groups/Subscribe"),
    uri: z.null().optional(),
    subscriber: url,
    group: url,
});

export const GroupUnsubscribeSchema = EntitySchema.extend({
    type: z.literal("pub.versia:groups/Unsubscribe"),
    uri: z.null().optional(),
    subscriber: url,
    group: url,
});

export const GroupSubscribeAcceptSchema = EntitySchema.extend({
    type: z.literal("pub.versia:groups/SubscribeAccept"),
    uri: z.null().optional(),
    subscriber: url,
    group: url,
});

export const GroupSubscribeRejectSchema = EntitySchema.extend({
    type: z.literal("pub.versia:groups/SubscribeReject"),
    uri: z.null().optional(),
    subscriber: url,
    group: url,
});
