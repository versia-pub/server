import { z } from "@hono/zod-openapi";
import { zBoolean } from "~/packages/config-manager/config.type";
import { Id } from "./common.ts";

export const CustomEmoji = z
    .object({
        /* Versia Server API extension */
        id: Id.openapi({
            description: "ID of the custom emoji in the database.",
            example: "af9ccd29-c689-477f-aa27-d7d95fd8fb05",
        }),
        shortcode: z.string().openapi({
            description: "The name of the custom emoji.",
            example: "blobaww",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/CustomEmoji/#shortcode",
            },
        }),
        url: z
            .string()
            .url()
            .openapi({
                description: "A link to the custom emoji.",
                example:
                    "https://cdn.versia.social/emojis/images/000/011/739/original/blobaww.png",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/CustomEmoji/#url",
                },
            }),
        static_url: z
            .string()
            .url()
            .openapi({
                description: "A link to a static copy of the custom emoji.",
                example:
                    "https://cdn.versia.social/emojis/images/000/011/739/static/blobaww.png",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/CustomEmoji/#static_url",
                },
            }),
        visible_in_picker: z.boolean().openapi({
            description:
                "Whether this Emoji should be visible in the picker or unlisted.",
            example: true,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/CustomEmoji/#visible_in_picker",
            },
        }),
        category: z
            .string()
            .nullable()
            .openapi({
                description: "Used for sorting custom emoji in the picker.",
                example: "Blobs",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/CustomEmoji/#category",
                },
            }),
        /* Versia Server API extension */
        global: zBoolean.openapi({
            description: "Whether this emoji is visible to all users.",
            example: false,
        }),
        /* Versia Server API extension */
        description: z
            .string()
            .nullable()
            .openapi({
                description:
                    "Emoji description for users using screen readers.",
                example: "A cute blob.",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/CustomEmoji/#description",
                },
            }),
    })
    .openapi({
        description: "Represents a custom emoji.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/CustomEmoji",
        },
    });
