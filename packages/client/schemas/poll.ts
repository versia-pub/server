import { z } from "zod";
import { Id } from "./common.ts";
import { CustomEmoji } from "./emoji.ts";

export const PollOption = z
    .object({
        title: z
            .string()
            .trim()
            .min(1)
            .meta({
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
            .meta({
                description:
                    "The total number of received votes for this option.",
                example: 6,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Poll/#Option-votes_count",
                },
            }),
    })
    .meta({
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Poll/#Option",
        },
        id: "PollOption",
    });

export const Poll = z
    .object({
        id: Id.meta({
            description: "ID of the poll in the database.",
            example: "d87d230f-e401-4282-80c7-2044ab989662",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Poll/#id",
            },
        }),
        expires_at: z.iso
            .datetime()
            .nullable()
            .meta({
                description: "When the poll ends.",
                example: "2025-01-07T14:11:00.000Z",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Poll/#expires_at",
                },
            }),
        expired: z.boolean().meta({
            description: "Is the poll currently expired?",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Poll/#expired",
            },
        }),
        multiple: z.boolean().meta({
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
            .meta({
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
            .meta({
                description:
                    "How many unique accounts have voted on a multiple-choice poll.",
                example: 3,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Poll/#voters_count",
                },
            }),
        options: z.array(PollOption).meta({
            description: "Possible answers for the poll.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Poll/#options",
            },
        }),
        emojis: z.array(CustomEmoji).meta({
            description: "Custom emoji to be used for rendering poll options.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Poll/#emojis",
            },
        }),
        voted: z
            .boolean()
            .optional()
            .meta({
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
            .meta({
                description:
                    "When called with a user token, which options has the authorized user chosen? Contains an array of index values for options.",
                example: [0],
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Poll/#own_votes",
                },
            }),
    })
    .meta({
        description: "Represents a poll attached to a status.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Poll",
        },
        id: "Poll",
    });
