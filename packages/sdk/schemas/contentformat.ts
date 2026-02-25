import { types } from "mime-types";
import { z } from "zod";
import { f64, u64 } from "./common.ts";

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
        hash: z.hash("sha256").nullish(),
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
