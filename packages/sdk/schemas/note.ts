import { z } from "zod/v4";
import { url } from "./common.ts";
import {
    NonTextContentFormatSchema,
    TextContentFormatSchema,
} from "./contentformat.ts";
import { EntitySchema } from "./entity.ts";
import { PollExtensionSchema } from "./extensions/polls.ts";

export const NoteSchema = EntitySchema.extend({
    type: z.literal("Note"),
    attachments: z.array(NonTextContentFormatSchema).nullish(),
    author: url,
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
    collections: z
        .strictObject({
            replies: url,
            quotes: url,
            "pub.versia:reactions/Reactions": url.nullish(),
            "pub.versia:share/Shares": url.nullish(),
            "pub.versia:likes/Likes": url.nullish(),
            "pub.versia:likes/Dislikes": url.nullish(),
        })
        .catchall(url),
    device: z
        .strictObject({
            name: z.string(),
            version: z.string().nullish(),
            url: url.nullish(),
        })
        .nullish(),
    group: url.or(z.enum(["public", "followers"])).nullish(),
    is_sensitive: z.boolean().nullish(),
    mentions: z.array(url).nullish(),
    previews: z
        .array(
            z.strictObject({
                link: url,
                title: z.string(),
                description: z.string().nullish(),
                image: url.nullish(),
                icon: url.nullish(),
            }),
        )
        .nullish(),
    quotes: url.nullish(),
    replies_to: url.nullish(),
    subject: z.string().nullish(),
    extensions: EntitySchema.shape.extensions
        .unwrap()
        .unwrap()
        .extend({
            "pub.versia:polls": PollExtensionSchema.nullish(),
        })
        .nullish(),
});
