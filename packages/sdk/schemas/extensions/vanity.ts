/**
 * Vanity extension schema.
 * @module federation/schemas/extensions/vanity
 * @see module:federation/schemas/base
 * @see https://versia.pub/extensions/vanity
 */

import { z } from "zod/v4";
import { ianaTimezoneRegex, isISOString } from "../../regex.ts";
import { url } from "../common.ts";
import {
    AudioContentFormatSchema,
    ImageContentFormatSchema,
} from "../contentformat.ts";

export const VanityExtensionSchema = z.strictObject({
    avatar_overlays: z.array(ImageContentFormatSchema).nullish(),
    avatar_mask: ImageContentFormatSchema.nullish(),
    background: ImageContentFormatSchema.nullish(),
    audio: AudioContentFormatSchema.nullish(),
    pronouns: z.record(
        z.string(),
        z.array(
            z.union([
                z.strictObject({
                    subject: z.string(),
                    object: z.string(),
                    dependent_possessive: z.string(),
                    independent_possessive: z.string(),
                    reflexive: z.string(),
                }),
                z.string(),
            ]),
        ),
    ),
    birthday: z
        .string()
        .refine((v) => isISOString(v), "must be a valid ISO8601 datetime")
        .nullish(),
    location: z.string().nullish(),
    aliases: z.array(url).nullish(),
    timezone: z
        .string()
        .regex(ianaTimezoneRegex, "must be a valid IANA timezone")
        .nullish(),
});
