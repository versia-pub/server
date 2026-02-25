import { z } from "zod";
import {
    ImageContentFormatSchema,
    TextContentFormatSchema,
} from "./contentformat.ts";
import { EntitySchema } from "./entity.ts";
import { MigrationExtensionSchema } from "./extensions/migration.ts";
import { VanityExtensionSchema } from "./extensions/vanity.ts";

export const UserSchema = EntitySchema.extend({
    type: z.literal("User"),
    avatar: ImageContentFormatSchema.nullish(),
    bio: TextContentFormatSchema.nullish(),
    display_name: z.string().nullish(),
    fields: z.array(
        z.strictObject({
            key: TextContentFormatSchema,
            value: TextContentFormatSchema,
        }),
    ),
    username: z
        .string()
        .min(1)
        .regex(
            /^[a-zA-Z0-9_-]+$/,
            "must be alphanumeric, and may contain _ or -",
        ),
    header: ImageContentFormatSchema.nullish(),
    manually_approves_followers: z.boolean(),
    indexable: z.boolean(),
    extensions: EntitySchema.shape.extensions
        .unwrap()
        .unwrap()
        .extend({
            "pub.versia:vanity": VanityExtensionSchema.nullish(),
            "pub.versia:migration": MigrationExtensionSchema.nullish(),
        })
        .nullish(),
});
