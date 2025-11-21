import { z } from "zod";
import { emojiRegex } from "../regex.ts";
import { Id, zBoolean } from "./common.ts";

export const CustomEmoji = z
    .object({
        /* Versia Server API extension */
        id: Id.meta({
            description: "ID of the custom emoji in the database.",
            example: "af9ccd29-c689-477f-aa27-d7d95fd8fb05",
        }),
        shortcode: z
            .string()
            .trim()
            .min(1)
            .regex(
                emojiRegex,
                "Shortcode must only contain letters (any case), numbers, dashes or underscores.",
            )
            .meta({
                description: "The name of the custom emoji.",
                example: "blobaww",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/CustomEmoji/#shortcode",
                },
            }),
        url: z.url().meta({
            description: "A link to the custom emoji.",
            example:
                "https://cdn.versia.social/emojis/images/000/011/739/original/blobaww.png",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/CustomEmoji/#url",
            },
        }),
        static_url: z.url().meta({
            description: "A link to a static copy of the custom emoji.",
            example:
                "https://cdn.versia.social/emojis/images/000/011/739/static/blobaww.png",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/CustomEmoji/#static_url",
            },
        }),
        visible_in_picker: z.boolean().meta({
            description:
                "Whether this Emoji should be visible in the picker or unlisted.",
            example: true,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/CustomEmoji/#visible_in_picker",
            },
        }),
        category: z
            .string()
            .trim()
            .max(64)
            .nullable()
            .meta({
                description: "Used for sorting custom emoji in the picker.",
                example: "Blobs",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/CustomEmoji/#category",
                },
            }),
        /* Versia Server API extension */
        global: zBoolean.meta({
            description: "Whether this emoji is visible to all users.",
            example: false,
        }),
        /* Versia Server API extension */
        description: z
            .string()
            .nullable()
            .meta({
                description:
                    "Emoji description for users using screen readers.",
                example: "A cute blob.",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/CustomEmoji/#description",
                },
            }),
    })
    .meta({
        description: "Represents a custom emoji.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/CustomEmoji",
        },
        id: "CustomEmoji",
    });
