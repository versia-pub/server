import { z } from "zod";
import { isISOString } from "../../regex.ts";
import { u64 } from "../common.ts";
import { TextContentFormatSchema } from "../contentformat.ts";
import { EntitySchema, ReferenceSchema } from "../entity.ts";

export const VoteSchema = EntitySchema.extend({
    type: z.literal("pub.versia:polls/Vote"),
    author: ReferenceSchema,
    poll: ReferenceSchema,
    option: u64,
});

export const PollExtensionSchema = z.strictObject({
    options: z.array(TextContentFormatSchema),
    votes: z.array(u64),
    multiple_choice: z.boolean(),
    expires_at: z
        .string()
        .refine((v) => isISOString(v), "must be a valid RFC 3339 datetime")
        .nullish(),
});
