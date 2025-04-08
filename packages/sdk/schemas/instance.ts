import { z } from "zod";
import { extensionRegex, semverRegex } from "../regex.ts";
import { url } from "./common.ts";
import { ImageContentFormatSchema } from "./contentformat.ts";
import { EntitySchema } from "./entity.ts";

export const InstanceMetadataSchema = EntitySchema.extend({
    type: z.literal("InstanceMetadata"),
    id: z.null().optional(),
    uri: z.null().optional(),
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
    host: z.string(),
    shared_inbox: url.nullish(),
    public_key: z.strictObject({
        key: z.string().min(1),
        algorithm: z.literal("ed25519"),
    }),
    moderators: url.nullish(),
    admins: url.nullish(),
    logo: ImageContentFormatSchema.nullish(),
    banner: ImageContentFormatSchema.nullish(),
});
