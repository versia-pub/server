import { z } from "zod/v4";
import { url } from "./common.ts";
import {
    ImageContentFormatSchema,
    TextContentFormatSchema,
} from "./contentformat.ts";
import { EntitySchema } from "./entity.ts";
import { MigrationExtensionSchema } from "./extensions/migration.ts";
import { VanityExtensionSchema } from "./extensions/vanity.ts";

export const PublicKeyDataSchema = z.strictObject({
    key: z.string().min(1),
    actor: url,
    algorithm: z.literal("ed25519"),
});

export const UserSchema = EntitySchema.extend({
    type: z.literal("User"),
    avatar: ImageContentFormatSchema.nullish(),
    bio: TextContentFormatSchema.nullish(),
    display_name: z.string().nullish(),
    fields: z
        .array(
            z.strictObject({
                key: TextContentFormatSchema,
                value: TextContentFormatSchema,
            }),
        )
        .nullish(),
    username: z
        .string()
        .min(1)
        .regex(
            /^[a-zA-Z0-9_-]+$/,
            "must be alphanumeric, and may contain _ or -",
        ),
    header: ImageContentFormatSchema.nullish(),
    public_key: PublicKeyDataSchema,
    manually_approves_followers: z.boolean().nullish(),
    indexable: z.boolean().nullish(),
    inbox: url,
    collections: z
        .object({
            featured: url,
            followers: url,
            following: url,
            outbox: url,
            "pub.versia:likes/Likes": url.nullish(),
            "pub.versia:likes/Dislikes": url.nullish(),
        })
        .catchall(url),
    extensions: EntitySchema.shape.extensions
        .unwrap()
        .unwrap()
        .extend({
            "pub.versia:vanity": VanityExtensionSchema.nullish(),
            "pub.versia:migration": MigrationExtensionSchema.nullish(),
        })
        .nullish(),
});
