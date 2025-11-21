import { z } from "zod";
import { Account } from "./account.ts";
import { Attachment } from "./attachment.ts";
import { PreviewCard } from "./card.ts";
import { Id, iso631, zBoolean } from "./common.ts";
import { CustomEmoji } from "./emoji.ts";
import { FilterResult } from "./filters.ts";
import { Poll } from "./poll.ts";
import { Tag } from "./tag.ts";
import { NoteReaction } from "./versia.ts";

export const Mention = z
    .object({
        id: Account.shape.id.meta({
            description: "The account ID of the mentioned user.",
            example: "b9dcb548-bd4d-42af-8b48-3693e6d298e6",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#Mention-id",
            },
        }),
        username: Account.shape.username.meta({
            description: "The username of the mentioned user.",
            example: "lexi",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#Mention-username",
            },
        }),
        url: Account.shape.url.meta({
            description: "The location of the mentioned user’s profile.",
            example: "https://beta.versia.social/@lexi",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#Mention-url",
            },
        }),
        acct: Account.shape.acct.meta({
            description:
                "The webfinger acct: URI of the mentioned user. Equivalent to username for local users, or username@domain for remote users.",
            example: "lexi@beta.versia.social",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#Mention-acct",
            },
        }),
    })
    .meta({
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#Mention",
        },
        id: "Mention",
    });

export const StatusSource = z
    .object({
        id: Id.meta({
            description: "ID of the status in the database.",
            example: "c7db92a4-e472-4e94-a115-7411ee934ba1",
        }),
        text: z.string().trim().meta({
            description: "The plain text used to compose the status.",
            example: "this is a status that will be edited",
        }),
        // min(0) because some masto-fe clients send empty spoiler_text
        // when they don't want to set it.
        spoiler_text: z.string().trim().min(0).max(1024).meta({
            description:
                "The plain text used to compose the status’s subject or content warning.",
            example: "",
        }),
    })
    .meta({
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/StatusSource",
        },
        id: "StatusSource",
    });

export const Status = z
    .object({
        id: Id.meta({
            description: "ID of the status in the database.",
            example: "2de861d3-a3dd-42ee-ba38-2c7d3f4af588",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#id",
            },
        }),
        uri: z.url().meta({
            description: "URI of the status used for federation.",
            example:
                "https://beta.versia.social/@lexi/2de861d3-a3dd-42ee-ba38-2c7d3f4af588",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#uri",
            },
        }),
        url: z
            .url()
            .nullable()
            .meta({
                description: "A link to the status’s HTML representation.",
                example:
                    "https://beta.versia.social/@lexi/2de861d3-a3dd-42ee-ba38-2c7d3f4af588",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#url",
                },
            }),
        account: Account.meta({
            description: "The account that authored this status.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#account",
            },
        }),
        in_reply_to_id: Id.nullable().meta({
            description: "ID of the status being replied to.",
            example: "c41c9fe9-919a-4d35-a921-d3e79a5c95f8",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#in_reply_to_id",
            },
        }),
        in_reply_to_account_id: Account.shape.id.nullable().meta({
            description:
                "ID of the account that authored the status being replied to.",
            example: "7b9b3ec6-1013-4cc6-8902-94ad00cf2ccc",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#in_reply_to_account_id",
            },
        }),

        content: z.string().meta({
            description: "HTML-encoded status content.",
            example: "<p>hello world</p>",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#content",
            },
        }),
        created_at: z.iso.datetime().meta({
            description: "The date when this status was created.",
            example: "2025-01-07T14:11:00.000Z",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#created_at",
            },
        }),
        edited_at: z.iso
            .datetime()
            .nullable()
            .meta({
                description: "Timestamp of when the status was last edited.",
                example: "2025-01-07T14:11:00.000Z",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#edited_at",
                },
            }),
        emojis: z.array(CustomEmoji).meta({
            description:
                "Custom emoji to be used when rendering status content.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#emojis",
            },
        }),
        replies_count: z
            .number()
            .int()
            .nonnegative()
            .meta({
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
            .meta({
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
            .meta({
                description: "How many favourites this status has received.",
                example: 11,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#favourites_count",
                },
            }),
        reblogged: zBoolean.optional().meta({
            description:
                "If the current token has an authorized user: Have you boosted this status?",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#reblogged",
            },
        }),
        favourited: zBoolean.optional().meta({
            description:
                "If the current token has an authorized user: Have you favourited this status?",
            example: true,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#favourited",
            },
        }),
        muted: zBoolean.optional().meta({
            description:
                "If the current token has an authorized user: Have you muted notifications for this status’s conversation?",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#muted",
            },
        }),
        sensitive: zBoolean.meta({
            description: "Is this status marked as sensitive content?",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#sensitive",
            },
        }),
        spoiler_text: z.string().meta({
            description:
                "Subject or summary line, below which status content is collapsed until expanded.",
            example: "lewd text",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#spoiler_text",
            },
        }),
        visibility: z.enum(["public", "unlisted", "private", "direct"]).meta({
            description: "Visibility of this status.",
            example: "public",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#visibility",
            },
        }),
        media_attachments: z.array(Attachment).meta({
            description: "Media that is attached to this status.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#media_attachments",
            },
        }),
        mentions: z.array(Mention).meta({
            description: "Mentions of users within the status content.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#mentions",
            },
        }),
        tags: z.array(Tag).meta({
            description: "Hashtags used within the status content.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#tags",
            },
        }),
        card: PreviewCard.nullable().meta({
            description:
                "Preview card for links included within status content.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#card",
            },
        }),
        poll: Poll.nullable().meta({
            description: "The poll attached to the status.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#poll",
            },
        }),
        application: z
            .object({
                name: z.string().meta({
                    description:
                        "The name of the application that posted this status.",
                    externalDocs: {
                        url: "https://docs.joinmastodon.org/entities/Status/#application-name",
                    },
                }),
                website: z
                    .url()
                    .nullable()
                    .meta({
                        description:
                            "The website associated with the application that posted this status.",
                        externalDocs: {
                            url: "https://docs.joinmastodon.org/entities/Status/#application-website",
                        },
                    }),
            })
            .optional()
            .meta({
                description: "The application used to post this status.",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#application",
                },
            }),
        language: iso631.nullable().meta({
            description: "Primary language of this status.",
            example: "en",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#language",
            },
        }),
        get reblog() {
            return Status.nullable().meta({
                description: "The status being reblogged.",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#reblog",
                },
            });
        },
        get quote() {
            return Status.nullable();
        },
        text: z
            .string()
            .nullable()
            .meta({
                description:
                    "Plain-text source of a status. Returned instead of content when status is deleted, so the user may redraft from the source text without the client having to reverse-engineer the original text from the HTML content.",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#text",
                },
            }),
        pinned: zBoolean.optional().meta({
            description:
                "If the current token has an authorized user: Have you pinned this status? Only appears if the status is pinnable.",
            example: true,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#pinned",
            },
        }),
        reactions: z.array(NoteReaction).meta({}),
        bookmarked: zBoolean.optional().meta({
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
            .meta({
                description:
                    "If the current token has an authorized user: The filter and keywords that matched this status.",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#filtered",
                },
            }),
    })
    .meta({
        id: "Status",
    });

export const ScheduledStatus = z
    .object({
        id: Id.meta({
            description: "ID of the scheduled status in the database.",
            example: "2de861d3-a3dd-42ee-ba38-2c7d3f4af588",
        }),
        scheduled_at: z.iso.datetime().meta({
            description: "When the status will be scheduled.",
            example: "2025-01-07T14:11:00.000Z",
        }),
        media_attachments: Status.shape.media_attachments,
        params: z.object({
            text: z.string().meta({
                description: "Text to be used as status content.",
                example: "Hello, world!",
            }),
            poll: Status.shape.poll,
            media_ids: z
                .array(Id)
                .nullable()
                .meta({
                    description:
                        "IDs of the MediaAttachments that will be attached to the status.",
                    example: ["1234567890", "1234567891"],
                }),
            sensitive: Status.shape.sensitive,
            spoiler_text: Status.shape.spoiler_text,
            visibility: Status.shape.visibility,
            in_reply_to_id: Status.shape.in_reply_to_id,
            /** Versia Server API Extension */
            quote_id: z.string().meta({
                description: "ID of the status being quoted.",
                example: "c5d62a13-f340-4e7d-8942-7fd14be688dc",
            }),
            language: Status.shape.language,
            scheduled_at: z.null().meta({
                description:
                    "When the status will be scheduled. This will be null because the status is only scheduled once.",
                example: null,
            }),
            idempotency: z.string().nullable().meta({
                description: "Idempotency key to prevent duplicate statuses.",
                example: "1234567890",
            }),
        }),
    })
    .meta({
        id: "ScheduledStatus",
    });
