import { z } from "zod";
import { TextContentFormatSchema } from "../contentformat.ts";
import {
    EntitySchema,
    ReferenceSchema,
    TransientEntitySchema,
} from "../entity.ts";

export const GroupSchema = EntitySchema.extend({
    type: z.literal("pub.versia:groups/Group"),
    name: TextContentFormatSchema.nullish(),
    description: TextContentFormatSchema.nullish(),
    open: z.boolean(),
});

export const GroupSubscribeSchema = TransientEntitySchema.extend({
    type: z.literal("pub.versia:groups/Subscribe"),
    subscriber: ReferenceSchema,
    group: ReferenceSchema,
});

export const GroupUnsubscribeSchema = TransientEntitySchema.extend({
    type: z.literal("pub.versia:groups/Unsubscribe"),
    subscriber: ReferenceSchema,
    group: ReferenceSchema,
});

export const GroupSubscribeAcceptSchema = TransientEntitySchema.extend({
    type: z.literal("pub.versia:groups/SubscribeAccept"),
    subscriber: ReferenceSchema,
    group: ReferenceSchema,
});

export const GroupSubscribeRejectSchema = TransientEntitySchema.extend({
    type: z.literal("pub.versia:groups/SubscribeReject"),
    subscriber: ReferenceSchema,
    group: ReferenceSchema,
});
