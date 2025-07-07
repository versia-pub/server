/**
 * Custom emojis extension.
 * @module federation/schemas/extensions/custom_emojis
 * @see module:federation/schemas/base
 * @see https://versia.pub/extensions/custom-emojis
 */
import { z } from "zod/v4";
import { emojiRegex } from "../../regex.ts";
import { ImageContentFormatSchema } from "../contentformat.ts";

export const CustomEmojiExtensionSchema = z.strictObject({
    emojis: z.array(
        z.strictObject({
            name: z
                .string()
                .min(1)
                .max(256)
                .regex(
                    emojiRegex,
                    "Emoji name must be alphanumeric, underscores, or dashes, and surrounded by identifiers",
                ),
            url: ImageContentFormatSchema,
        }),
    ),
});
