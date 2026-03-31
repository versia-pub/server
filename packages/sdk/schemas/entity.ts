import { z } from "zod";
import { isISOString } from "../regex.ts";
import { CustomEmojiExtensionSchema } from "./extensions/emojis.ts";

export const ExtensionPropertySchema = z
    .object({
        "pub.versia:custom_emojis":
            CustomEmojiExtensionSchema.optional().nullable(),
    })
    .catchall(z.any());

export const ReferenceSchema = z.string();

export const EntitySchema = z.strictObject({
    // biome-ignore lint/style/useNamingConvention: required for JSON schema
    $schema: z.url().nullish(),
    id: z
        .string()
        .max(512)
        .regex(
            // a-z, A-Z, 0-9, - and _
            /^[A-Za-z0-9\-_]+$/,
            "can only contain alphanumeric characters, hyphens and underscores",
        ),
    created_at: z
        .string()
        .refine((v) => isISOString(v), "must be a valid RFC 3339 datetime"),
    type: z.string(),
    extensions: ExtensionPropertySchema.nullish(),
});

export const TransientEntitySchema = EntitySchema.extend({
    id: z.null().optional(),
});
