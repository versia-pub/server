import { z } from "zod";
import { userAddressRegex } from "../regex.ts";
import { iso631, zBoolean } from "./common.ts";
import { CustomEmoji } from "./emoji.ts";
import { Role } from "./versia.ts";

export const Field = z
    .object({
        name: z
            .string()
            .trim()
            .min(1)
            .openapi({
                description: "The key of a given field’s key-value pair.",
                example: "Freak level",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#name",
                },
            }),
        value: z
            .string()
            .trim()
            .min(1)
            .openapi({
                description: "The value associated with the name key.",
                example: "<p>High</p>",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#value",
                },
            }),
        verified_at: z
            .string()
            .datetime()
            .nullable()
            .openapi({
                description:
                    "Timestamp of when the server verified a URL value for a rel=“me” link.",
                example: null,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#verified_at",
                },
            }),
    })
    .openapi({ ref: "AccountField" });

export const Source = z
    .object({
        privacy: z.enum(["public", "unlisted", "private", "direct"]).openapi({
            description:
                "The default post privacy to be used for new statuses.",
            example: "unlisted",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#source-privacy",
            },
        }),
        sensitive: zBoolean.openapi({
            description:
                "Whether new statuses should be marked sensitive by default.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#source-sensitive",
            },
        }),
        language: iso631.openapi({
            description: "The default posting language for new statuses.",
            example: "en",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#source-language",
            },
        }),
        follow_requests_count: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .openapi({
                description: "The number of pending follow requests.",
                example: 3,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#follow_requests_count",
                },
            }),
        note: z
            .string()
            .trim()
            .min(0)
            .openapi({
                description: "Profile bio, in plain-text instead of in HTML.",
                example: "ermmm what the meow meow",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#source-note",
                },
            }),
        fields: z.array(Field).openapi({
            description: "Metadata about the account.",
        }),
    })
    .openapi({
        description:
            "An extra attribute that contains source values to be used with API methods that verify credentials and update credentials.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Account/#source",
        },
        ref: "AccountSource",
    });

// Because Account has some recursive references, we need to define it like this
const BaseAccount = z
    .object({
        id: z
            .string()
            .uuid()
            .openapi({
                description: "The account ID in the database.",
                example: "9e84842b-4db6-4a9b-969d-46ab408278da",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#id",
                },
            }),
        username: z
            .string()
            .min(3)
            .trim()
            .regex(
                /^[a-z0-9_-]+$/,
                "Username can only contain letters, numbers, underscores and hyphens",
            )
            .openapi({
                description:
                    "The username of the account, not including domain.",
                example: "lexi",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#username",
                },
            }),
        acct: z
            .string()
            .min(1)
            .trim()
            .regex(userAddressRegex, "Invalid user address")
            .openapi({
                description:
                    "The Webfinger account URI. Equal to username for local users, or username@domain for remote users.",
                example: "lexi@beta.versia.social",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#acct",
                },
            }),
        url: z
            .string()
            .url()
            .openapi({
                description: "The location of the user’s profile page.",
                example: "https://beta.versia.social/@lexi",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#url",
                },
            }),
        display_name: z
            .string()
            .min(3)
            .trim()
            .openapi({
                description: "The profile’s display name.",
                example: "Lexi :flower:",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#display_name",
                },
            }),
        note: z
            .string()
            .min(0)
            .trim()
            .openapi({
                description: "The profile’s bio or description.",
                example: "<p>ermmm what the meow meow</p>",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#note",
                },
            }),
        avatar: z
            .string()
            .url()
            .openapi({
                description:
                    "An image icon that is shown next to statuses and in the profile.",
                example:
                    "https://cdn.versia.social/avatars/cff9aea0-0000-43fe-8b5e-e7c7ea69a488/lexi.webp",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#avatar",
                },
            }),
        avatar_static: z
            .string()
            .url()
            .openapi({
                description:
                    "A static version of the avatar. Equal to avatar if its value is a static image; different if avatar is an animated GIF.",
                example:
                    "https://cdn.versia.social/avatars/cff9aea0-0000-43fe-8b5e-e7c7ea69a488/lexi.webp",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#avatar_static",
                },
            }),
        header: z
            .string()
            .url()
            .openapi({
                description:
                    "An image banner that is shown above the profile and in profile cards.",
                example:
                    "https://cdn.versia.social/headers/a049f8e3-878c-4faa-ae4c-a6bcceddbd9d/femboy_2.webp",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#header",
                },
            }),
        header_static: z
            .string()
            .url()
            .openapi({
                description:
                    "A static version of the header. Equal to header if its value is a static image; different if header is an animated GIF.",
                example:
                    "https://cdn.versia.social/headers/a049f8e3-878c-4faa-ae4c-a6bcceddbd9d/femboy_2.webp",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#header_static",
                },
            }),
        locked: zBoolean.openapi({
            description:
                "Whether the account manually approves follow requests.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#locked",
            },
        }),
        fields: z.array(Field).openapi({
            description:
                "Additional metadata attached to a profile as name-value pairs.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#fields",
            },
        }),
        emojis: z.array(CustomEmoji).openapi({
            description:
                "Custom emoji entities to be used when rendering the profile.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#emojis",
            },
        }),
        bot: zBoolean.openapi({
            description:
                "Indicates that the account may perform automated actions, may not be monitored, or identifies as a robot.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#bot",
            },
        }),
        group: z.literal(false).openapi({
            description: "Indicates that the account represents a Group actor.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#group",
            },
        }),
        discoverable: zBoolean.nullable().openapi({
            description:
                "Whether the account has opted into discovery features such as the profile directory.",
            example: true,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#discoverable",
            },
        }),
        noindex: zBoolean
            .nullable()
            .optional()
            .openapi({
                description:
                    "Whether the local user has opted out of being indexed by search engines.",
                example: false,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#noindex",
                },
            }),
        suspended: zBoolean.optional().openapi({
            description:
                "An extra attribute returned only when an account is suspended.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#suspended",
            },
        }),
        limited: zBoolean.optional().openapi({
            description:
                "An extra attribute returned only when an account is silenced. If true, indicates that the account should be hidden behind a warning screen.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#limited",
            },
        }),
        created_at: z
            .string()
            .datetime()
            .openapi({
                description: "When the account was created.",
                example: "2024-10-15T22:00:00.000Z",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#created_at",
                },
            }),
        // TODO
        last_status_at: z
            .literal(null)
            .openapi({
                description: "When the most recent status was posted.",
                example: null,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#last_status_at",
                },
            })
            .nullable(),
        statuses_count: z
            .number()
            .int()
            .nonnegative()
            .openapi({
                description: "How many statuses are attached to this account.",
                example: 42,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#statuses_count",
                },
            }),
        followers_count: z
            .number()
            .int()
            .nonnegative()
            .openapi({
                description: "The reported followers of this profile.",
                example: 6,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#followers_count",
                },
            }),
        following_count: z
            .number()
            .int()
            .nonnegative()
            .openapi({
                description: "The reported follows of this profile.",
                example: 23,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Account/#following_count",
                },
            }),
        /* Versia Server API extension */
        uri: z.string().url().openapi({
            description:
                "The location of the user's Versia profile page, as opposed to the local representation.",
            example:
                "https://beta.versia.social/users/9e84842b-4db6-4a9b-969d-46ab408278da",
        }),
        source: Source.optional(),
        role: z
            .object({
                name: z.string(),
            })
            .optional(),
        /* Versia Server API extension */
        roles: z.array(Role).openapi({
            description: "Roles assigned to the account.",
        }),
        mute_expires_at: z.string().datetime().nullable().openapi({
            description: "When a timed mute will expire, if applicable.",
            example: "2025-03-01T14:00:00.000Z",
        }),
    })
    .openapi({ ref: "BaseAccount" });

export const Account = BaseAccount.extend({
    moved: BaseAccount.nullable()
        .optional()
        .openapi({
            description:
                "Indicates that the profile is currently inactive and that its user has moved to a new account.",
            example: null,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Account/#moved",
            },
        }),
}).openapi({ ref: "Account" });
