import { z } from "zod";
import { isISOString } from "../regex.ts";
import { url } from "./common.ts";
import { CustomEmojiExtensionSchema } from "./extensions/emojis.ts";

export const ExtensionPropertySchema = z
    .object({
        "pub.versia:custom_emojis":
            CustomEmojiExtensionSchema.optional().nullable(),
    })
    .catchall(z.any());

export const EntitySchema = z.strictObject({
    // biome-ignore lint/style/useNamingConvention: required for JSON schema
    $schema: z.url().nullish(),
    id: z.string().max(512),
    created_at: z
        .string()
        .refine((v) => isISOString(v), "must be a valid ISO8601 datetime"),
    uri: url,
    type: z.string(),
    extensions: ExtensionPropertySchema.nullish(),
});
