import { z } from "@hono/zod-openapi";
import type { Status as ApiNote } from "@versia/client/types";
import { Emoji, Media } from "@versia/kit/db";
import ISO6391 from "iso-639-1";
import { zBoolean } from "~/packages/config-manager/config.type.ts";
import { Account } from "./account.ts";
import { PreviewCard } from "./card.ts";
import { Id } from "./common.ts";
import { FilterResult } from "./filters.ts";

export const Mention = z
    .object({
        id: Account.shape.id.openapi({
            description: "The account ID of the mentioned user.",
            example: "b9dcb548-bd4d-42af-8b48-3693e6d298e6",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#Mention-id",
            },
        }),
        username: Account.shape.username.openapi({
            description: "The username of the mentioned user.",
            example: "lexi",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#Mention-username",
            },
        }),
        url: Account.shape.url.openapi({
            description: "The location of the mentioned user’s profile.",
            example: "https://beta.versia.social/@lexi",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#Mention-url",
            },
        }),
        acct: Account.shape.acct.openapi({
            description:
                "The webfinger acct: URI of the mentioned user. Equivalent to username for local users, or username@domain for remote users.",
            example: "lexi@beta.versia.social",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#Mention-acct",
            },
        }),
    })
    .openapi({
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#Mention",
        },
    });

export const Tag = z
    .object({
        name: z
            .string()
            .min(1)
            .max(128)
            .openapi({
                description: "The value of the hashtag after the # sign.",
                example: "versia",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#Tag-name",
                },
            }),
        url: z
            .string()
            .url()
            .openapi({
                description: "A link to the hashtag on the instance.",
                example: "https://beta.versia.social/tags/versia",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#Tag-url",
                },
            }),
    })
    .openapi({
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#Tag",
        },
    });

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

export const Poll = z.object({
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
    expired: zBoolean.openapi({
        description: "Is the poll currently expired?",
        example: false,
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Poll/#expired",
        },
    }),
    multiple: zBoolean.openapi({
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
    emojis: z.array(Emoji.schema).openapi({
        description: "Custom emoji to be used for rendering poll options.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Poll/#emojis",
        },
    }),
    voted: zBoolean.optional().openapi({
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
});

export const Status = z.object({
    id: Id.openapi({
        description: "ID of the status in the database.",
        example: "2de861d3-a3dd-42ee-ba38-2c7d3f4af588",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#id",
        },
    }),
    uri: z
        .string()
        .url()
        .openapi({
            description: "URI of the status used for federation.",
            example:
                "https://beta.versia.social/@lexi/2de861d3-a3dd-42ee-ba38-2c7d3f4af588",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#uri",
            },
        }),
    url: z
        .string()
        .url()
        .nullable()
        .openapi({
            description: "A link to the status’s HTML representation.",
            example:
                "https://beta.versia.social/@lexi/2de861d3-a3dd-42ee-ba38-2c7d3f4af588",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#url",
            },
        }),
    account: Account.openapi({
        description: "The account that authored this status.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#account",
        },
    }),
    in_reply_to_id: Id.nullable().openapi({
        description: "ID of the status being replied to.",
        example: "c41c9fe9-919a-4d35-a921-d3e79a5c95f8",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#in_reply_to_id",
        },
    }),
    in_reply_to_account_id: Account.shape.id.nullable().openapi({
        description:
            "ID of the account that authored the status being replied to.",
        example: "7b9b3ec6-1013-4cc6-8902-94ad00cf2ccc",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#in_reply_to_account_id",
        },
    }),
    reblog: z
        .lazy((): z.ZodType<ApiNote> => Status as z.ZodType<ApiNote>)
        .nullable()
        .openapi({
            description: "The status being reblogged.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#reblog",
            },
        }),
    content: z.string().openapi({
        description: "HTML-encoded status content.",
        example: "<p>hello world</p>",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#content",
        },
    }),
    created_at: z
        .string()
        .datetime()
        .openapi({
            description: "The date when this status was created.",
            example: "2025-01-07T14:11:00.000Z",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#created_at",
            },
        }),
    edited_at: z
        .string()
        .datetime()
        .nullable()
        .openapi({
            description: "Timestamp of when the status was last edited.",
            example: "2025-01-07T14:11:00.000Z",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#edited_at",
            },
        }),
    emojis: z.array(Emoji.schema).openapi({
        description: "Custom emoji to be used when rendering status content.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#emojis",
        },
    }),
    replies_count: z
        .number()
        .int()
        .nonnegative()
        .openapi({
            description: "How many replies this status has received.",
            example: 1,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#replies_count",
            },
        }),
    reblogs_count: z
        .number()
        .int()
        .nonnegative()
        .openapi({
            description: "How many boosts this status has received.",
            example: 6,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#reblogs_count",
            },
        }),
    favourites_count: z
        .number()
        .int()
        .nonnegative()
        .openapi({
            description: "How many favourites this status has received.",
            example: 11,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#favourites_count",
            },
        }),
    reblogged: zBoolean.optional().openapi({
        description:
            "If the current token has an authorized user: Have you boosted this status?",
        example: false,
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#reblogged",
        },
    }),
    favourited: zBoolean.optional().openapi({
        description:
            "If the current token has an authorized user: Have you favourited this status?",
        example: true,
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#favourited",
        },
    }),
    muted: zBoolean.optional().openapi({
        description:
            "If the current token has an authorized user: Have you muted notifications for this status’s conversation?",
        example: false,
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#muted",
        },
    }),
    sensitive: zBoolean.openapi({
        description: "Is this status marked as sensitive content?",
        example: false,
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#sensitive",
        },
    }),
    spoiler_text: z.string().openapi({
        description:
            "Subject or summary line, below which status content is collapsed until expanded.",
        example: "lewd text",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#spoiler_text",
        },
    }),
    visibility: z.enum(["public", "unlisted", "private", "direct"]).openapi({
        description: "Visibility of this status.",
        example: "public",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#visibility",
        },
    }),
    media_attachments: z.array(Media.schema).openapi({
        description: "Media that is attached to this status.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#media_attachments",
        },
    }),
    mentions: z.array(Mention).openapi({
        description: "Mentions of users within the status content.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#mentions",
        },
    }),
    tags: z.array(Tag).openapi({
        description: "Hashtags used within the status content.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#tags",
        },
    }),
    card: PreviewCard.nullable().openapi({
        description: "Preview card for links included within status content.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#card",
        },
    }),
    poll: Poll.nullable().openapi({
        description: "The poll attached to the status.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#poll",
        },
    }),
    application: z
        .object({
            name: z.string().openapi({
                description:
                    "The name of the application that posted this status.",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#application-name",
                },
            }),
            website: z
                .string()
                .url()
                .nullable()
                .openapi({
                    description:
                        "The website associated with the application that posted this status.",
                    externalDocs: {
                        url: "https://docs.joinmastodon.org/entities/Status/#application-website",
                    },
                }),
        })
        .optional()
        .openapi({
            description: "The application used to post this status.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#application",
            },
        }),
    language: z
        .enum(ISO6391.getAllCodes() as [string, ...string[]])
        .nullable()
        .openapi({
            description: "Primary language of this status.",
            example: "en",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#language",
            },
        }),
    text: z
        .string()
        .nullable()
        .openapi({
            description:
                "Plain-text source of a status. Returned instead of content when status is deleted, so the user may redraft from the source text without the client having to reverse-engineer the original text from the HTML content.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#text",
            },
        }),
    pinned: zBoolean.optional().openapi({
        description:
            "If the current token has an authorized user: Have you pinned this status? Only appears if the status is pinnable.",
        example: true,
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#pinned",
        },
    }),
    emoji_reactions: z.array(
        z.object({
            count: z.number().int().nonnegative(),
            me: zBoolean,
            name: z.string(),
            url: z.string().url().optional(),
            static_url: z.string().url().optional(),
            accounts: z.array(Account).optional(),
            account_ids: z.array(z.string().uuid()).optional(),
        }),
    ),
    quote: z
        .lazy((): z.ZodType<ApiNote> => Status as z.ZodType<ApiNote>)
        .nullable(),
    bookmarked: zBoolean.optional().openapi({
        description:
            "If the current token has an authorized user: Have you bookmarked this status?",
        example: false,
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#bookmarked",
        },
    }),
    filtered: z
        .array(FilterResult)
        .optional()
        .openapi({
            description:
                "If the current token has an authorized user: The filter and keywords that matched this status.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#filtered",
            },
        }),
});
