import { z } from "@hono/zod-openapi";
import { Id } from "./common.ts";
import { CustomEmoji } from "./emoji.ts";

export const PollOption = z
    .object({
        title: z.string().openapi({
            description: "The text value of the poll option.",
            example: "yes",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Poll/#Option-title",
            },
        }),
        votes_count: z
            .number()
            .int()
            .nonnegative()
            .nullable()
            .openapi({
                description:
                    "The total number of received votes for this option.",
                example: 6,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Poll/#Option-votes_count",
                },
            }),
    })
    .openapi({
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Poll/#Option",
        },
    });

export const Poll = z
    .object({
        id: Id.openapi({
            description: "ID of the poll in the database.",
            example: "d87d230f-e401-4282-80c7-2044ab989662",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Poll/#id",
            },
        }),
        expires_at: z
            .string()
            .datetime()
            .nullable()
            .openapi({
                description: "When the poll ends.",
                example: "2025-01-07T14:11:00.000Z",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Poll/#expires_at",
                },
            }),
        expired: z.boolean().openapi({
            description: "Is the poll currently expired?",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Poll/#expired",
            },
        }),
        multiple: z.boolean().openapi({
            description: "Does the poll allow multiple-choice answers?",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Poll/#multiple",
            },
        }),
        votes_count: z
            .number()
            .int()
            .nonnegative()
            .openapi({
                description: "How many votes have been received.",
                example: 6,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Poll/#votes_count",
                },
            }),
        voters_count: z
            .number()
            .int()
            .nonnegative()
            .nullable()
            .openapi({
                description:
                    "How many unique accounts have voted on a multiple-choice poll.",
                example: 3,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Poll/#voters_count",
                },
            }),
        options: z.array(PollOption).openapi({
            description: "Possible answers for the poll.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Poll/#options",
            },
        }),
        emojis: z.array(CustomEmoji).openapi({
            description: "Custom emoji to be used for rendering poll options.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Poll/#emojis",
            },
        }),
        voted: z
            .boolean()
            .optional()
            .openapi({
                description:
                    "When called with a user token, has the authorized user voted?",
                example: true,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Poll/#voted",
                },
            }),
        own_votes: z
            .array(z.number().int())
            .optional()
            .openapi({
                description:
                    "When called with a user token, which options has the authorized user chosen? Contains an array of index values for options.",
                example: [0],
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Poll/#own_votes",
                },
            }),
    })
    .openapi({
        description: "Represents a poll attached to a status.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Poll",
        },
    });
