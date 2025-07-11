import { z } from "zod/v4";
import { Id, zBoolean } from "./common.ts";

export const FilterStatus = z
    .object({
        id: Id.meta({
            description: "The ID of the FilterStatus in the database.",
            example: "3b19ed7c-0c4b-45e1-8c75-e21dfc8e86c3",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/FilterStatus/#id",
            },
        }),
        status_id: Id.meta({
            description: "The ID of the Status that will be filtered.",
            example: "4f941ac8-295c-4c2d-9300-82c162ac8028",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/FilterStatus/#status_id",
            },
        }),
    })
    .meta({
        description:
            "Represents a status ID that, if matched, should cause the filter action to be taken.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/FilterStatus",
        },
        id: "FilterStatus",
    });

export const FilterKeyword = z
    .object({
        id: Id.meta({
            description: "The ID of the FilterKeyword in the database.",
            example: "ca921e60-5b96-4686-90f3-d7cc420d7391",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/FilterKeyword/#id",
            },
        }),
        keyword: z.string().meta({
            description: "The phrase to be matched against.",
            example: "badword",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/FilterKeyword/#keyword",
            },
        }),
        whole_word: zBoolean.meta({
            description:
                "Should the filter consider word boundaries? See implementation guidelines for filters.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/FilterKeyword/#whole_word",
            },
        }),
    })
    .meta({
        description:
            "Represents a keyword that, if matched, should cause the filter action to be taken.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/FilterKeyword",
        },
        id: "FilterKeyword",
    });

export const Filter = z
    .object({
        id: Id.meta({
            description: "The ID of the Filter in the database.",
            example: "6b8fa22f-b128-43c2-9a1f-3c0499ef3a51",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Filter/#id",
            },
        }),
        title: z
            .string()
            .trim()
            .min(1)
            .max(255)
            .meta({
                description: "A title given by the user to name the filter.",
                example: "Test filter",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Filter/#title",
                },
            }),
        context: z
            .array(
                z.enum([
                    "home",
                    "notifications",
                    "public",
                    "thread",
                    "account",
                ]),
            )
            .default([])
            .meta({
                description:
                    "The contexts in which the filter should be applied.",
                example: ["home"],
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Filter/#context",
                },
            }),
        expires_at: z
            .string()
            .nullable()
            .meta({
                description: "When the filter should no longer be applied.",
                example: "2026-09-20T17:27:39.296Z",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Filter/#expires_at",
                },
            }),
        filter_action: z
            .enum(["warn", "hide"])
            .default("warn")
            .meta({
                description:
                    "The action to be taken when a status matches this filter.",
                example: "warn",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Filter/#filter_action",
                },
            }),
        keywords: z.array(FilterKeyword).meta({
            description: "The keywords grouped under this filter.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Filter/#keywords",
            },
        }),
        statuses: z.array(FilterStatus).meta({
            description: "The statuses grouped under this filter.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Filter/#statuses",
            },
        }),
    })
    .meta({
        description:
            "Represents a user-defined filter for determining which statuses should not be shown to the user.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Filter",
        },
        id: "Filter",
    });

export const FilterResult = z
    .object({
        filter: Filter.meta({
            description: "The filter that was matched.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/FilterResult/#filter",
            },
        }),
        keyword_matches: z
            .array(z.string())
            .nullable()
            .meta({
                description: "The keyword within the filter that was matched.",
                example: ["badword"],
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/FilterResult/#keyword_matches",
                },
            }),
        status_matches: z
            .array(Id)
            .nullable()
            .meta({
                description:
                    "The status ID within the filter that was matched.",
                example: ["3819515a-5ceb-4078-8524-c939e38dcf8f"],
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/FilterResult/#status_matches",
                },
            }),
    })
    .meta({
        description:
            "Represents a filter whose keywords matched a given status.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/FilterResult",
        },
        id: "FilterResult",
    });
