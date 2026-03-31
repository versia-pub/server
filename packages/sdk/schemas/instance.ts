import { z } from "zod";
import { extensionRegex, semverRegex } from "../regex.ts";
import { ImageContentFormatSchema } from "./contentformat.ts";
import { TransientEntitySchema } from "./entity.ts";

export const InstanceMetadataSchema = TransientEntitySchema.extend({
    type: z.literal("InstanceMetadata"),
    name: z.string().min(1),
    software: z.strictObject({
        name: z.string().min(1),
        version: z.string().min(1),
    }),
    compatibility: z.strictObject({
        versions: z.array(
            z.string().regex(semverRegex, "must be a valid SemVer version"),
        ),
        extensions: z.array(
            z
                .string()
                .min(1)
                .regex(
                    extensionRegex,
                    "must be in the format 'namespaced_url:extension_name', e.g. 'pub.versia:reactions'",
                ),
        ),
    }),
    description: z.string().nullish(),
    domain: z.string(),
    public_key: z.strictObject({
        key: z.string().min(1),
        algorithm: z.literal("ed25519"),
    }),
    logo: ImageContentFormatSchema.nullish(),
    banner: ImageContentFormatSchema.nullish(),
});
