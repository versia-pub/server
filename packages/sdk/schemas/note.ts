import { z } from "zod";
import { url } from "./common.ts";
import {
    NonTextContentFormatSchema,
    TextContentFormatSchema,
} from "./contentformat.ts";
import { EntitySchema, ReferenceSchema } from "./entity.ts";
import { PollExtensionSchema } from "./extensions/polls.ts";

export const NoteSchema = EntitySchema.extend({
    type: z.literal("Note"),
    attachments: z.array(NonTextContentFormatSchema),
    author: ReferenceSchema,
    category: z
        .enum([
            "microblog",
            "forum",
            "blog",
            "image",
            "video",
            "audio",
            "messaging",
        ])
        .nullish(),
    content: TextContentFormatSchema.nullish(),
    device: z
        .strictObject({
            name: z.string(),
            version: z.string().nullish(),
            url: url.nullish(),
        })
        .nullish(),
    group: ReferenceSchema.or(z.enum(["public", "followers"])).nullish(),
    is_sensitive: z.boolean(),
    mentions: z.array(ReferenceSchema),
    previews: z.array(
        z.strictObject({
            link: url,
            title: z.string(),
            description: z.string().nullish(),
            image: url.nullish(),
            icon: url.nullish(),
        }),
    ),
    quotes: ReferenceSchema.nullish(),
    replies_to: ReferenceSchema.nullish(),
    subject: z.string().nullish(),
    extensions: EntitySchema.shape.extensions
        .unwrap()
        .unwrap()
        .extend({
            "pub.versia:polls": PollExtensionSchema.nullish(),
        })
        .nullish(),
});
