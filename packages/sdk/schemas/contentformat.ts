import { types } from "mime-types";
import { z } from "zod/v4";
import { f64, u64 } from "./common.ts";

const hashSizes = {
    sha256: 64,
    sha512: 128,
    "sha3-256": 64,
    "sha3-512": 128,
    "blake2b-256": 64,
    "blake2b-512": 128,
    "blake3-256": 64,
    "blake3-512": 128,
    md5: 32,
    sha1: 40,
    sha224: 56,
    sha384: 96,
    "sha3-224": 56,
    "sha3-384": 96,
    "blake2s-256": 64,
    "blake2s-512": 128,
    "blake3-224": 56,
    "blake3-384": 96,
};
const allMimeTypes = Object.values(types) as [string, ...string[]];
const textMimeTypes = Object.values(types).filter((v) =>
    v.startsWith("text/"),
) as [string, ...string[]];
const nonTextMimeTypes = Object.values(types).filter(
    (v) => !v.startsWith("text/"),
) as [string, ...string[]];
const imageMimeTypes = Object.values(types).filter((v) =>
    v.startsWith("image/"),
) as [string, ...string[]];
const videoMimeTypes = Object.values(types).filter((v) =>
    v.startsWith("video/"),
) as [string, ...string[]];
const audioMimeTypes = Object.values(types).filter((v) =>
    v.startsWith("audio/"),
) as [string, ...string[]];

export const ContentFormatSchema = z.partialRecord(
    z.enum(allMimeTypes),
    z.strictObject({
        content: z.string().or(z.url()),
        remote: z.boolean(),
        description: z.string().nullish(),
        size: u64.nullish(),
        hash: z
            .strictObject(
                Object.fromEntries(
                    Object.entries(hashSizes).map(([k, v]) => [
                        k,
                        z.string().length(v).nullish(),
                    ]),
                ),
            )
            .nullish(),
        thumbhash: z.string().nullish(),
        width: u64.nullish(),
        height: u64.nullish(),
        duration: f64.nullish(),
        fps: u64.nullish(),
    }),
);

export const TextContentFormatSchema = z.partialRecord(
    z.enum(textMimeTypes),
    ContentFormatSchema.valueType
        .pick({
            content: true,
            remote: true,
        })
        .extend({
            content: z.string(),
            remote: z.literal(false),
        }),
);

export const NonTextContentFormatSchema = z.partialRecord(
    z.enum(nonTextMimeTypes),
    ContentFormatSchema.valueType
        .pick({
            content: true,
            remote: true,
            description: true,
            size: true,
            hash: true,
            thumbhash: true,
            width: true,
            height: true,
        })
        .extend({
            content: z.url(),
            remote: z.literal(true),
        }),
);

export const ImageContentFormatSchema = z.partialRecord(
    z.enum(imageMimeTypes),
    NonTextContentFormatSchema.valueType,
);

export const VideoContentFormatSchema = z.partialRecord(
    z.enum(videoMimeTypes),
    NonTextContentFormatSchema.valueType.extend({
        duration: ContentFormatSchema.valueType.shape.duration,
        fps: ContentFormatSchema.valueType.shape.fps,
    }),
);

export const AudioContentFormatSchema = z.partialRecord(
    z.enum(audioMimeTypes),
    NonTextContentFormatSchema.valueType.extend({
        duration: ContentFormatSchema.valueType.shape.duration,
    }),
);
