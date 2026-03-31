/**
 * Vanity extension schema.
 * @module federation/schemas/extensions/vanity
 * @see module:federation/schemas/base
 * @see https://versia.pub/extensions/vanity
 */

import { z } from "zod";
import { ianaTimezoneRegex, isISOString } from "../../regex.ts";
import {
    AudioContentFormatSchema,
    ImageContentFormatSchema,
} from "../contentformat.ts";
import { ReferenceSchema } from "../entity.ts";

export const VanityExtensionSchema = z.strictObject({
    avatar_overlays: z.array(ImageContentFormatSchema).nullish(),
    avatar_mask: ImageContentFormatSchema.nullish(),
    background: ImageContentFormatSchema.nullish(),
    audio: AudioContentFormatSchema.nullish(),
    pronouns: z.record(
        z.string(),
        z.array(
            z.strictObject({
                subject: z.string(),
                object: z.string(),
                dependent_possessive: z.string(),
                independent_possessive: z.string(),
                reflexive: z.string(),
            }),
        ),
    ),
    birthday: z
        .string()
        .refine((v) => isISOString(v), "must be a valid RFC 3339 datetime")
        .nullish(),
    location: z.string().nullish(),
    aliases: z.array(ReferenceSchema).nullish(),
    timezone: z
        .string()
        .regex(ianaTimezoneRegex, "must be a valid IANA timezone")
        .nullish(),
});
