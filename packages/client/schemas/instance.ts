import { z } from "zod";
import { Account } from "./account.ts";
import { iso631 } from "./common.ts";
import { Rule } from "./rule.ts";
import { SSOConfig } from "./versia.ts";

const InstanceIcon = z
    .object({
        src: z.string().url().openapi({
            description: "The URL of this icon.",
            example:
                "https://files.mastodon.social/site_uploads/files/000/000/003/36/accf17b0104f18e5.png",
        }),
        size: z.string().openapi({
            description:
                "The size of this icon (in the form of 12x34, where 12 is the width and 34 is the height of the icon).",
            example: "36x36",
        }),
    })
    .openapi({
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/InstanceIcon",
        },
        ref: "InstanceIcon",
    });

export const Instance = z
    .object({
        domain: z.string().openapi({
            description: "The domain name of the instance.",
            example: "versia.social",
        }),
        title: z.string().openapi({
            description: "The title of the website.",
            example: "Versia Social • Now with 100% more blobs!",
        }),
        version: z.string().openapi({
            description:
                "Mastodon version that the API is compatible with. Used for compatibility with Mastodon clients.",
            example: "4.3.0+glitch",
        }),
        /* Versia Server API extension */
        versia_version: z.string().openapi({
            description: "Versia Server version.",
            example: "0.8.0",
        }),
        source_url: z.string().url().openapi({
            description:
                "The URL for the source code of the software running on this instance, in keeping with AGPL license requirements.",
            example: "https://github.com/versia-pub/server",
        }),
        description: z.string().openapi({
            description:
                "A short, plain-text description defined by the admin.",
            example: "The flagship Versia Server instance. Join for free hugs!",
        }),
        usage: z
            .object({
                users: z
                    .object({
                        active_month: z.number().openapi({
                            description:
                                "The number of active users in the past 4 weeks.",
                            example: 1_261,
                        }),
                    })
                    .openapi({
                        description:
                            "Usage data related to users on this instance.",
                    }),
            })
            .openapi({ description: "Usage data for this instance." }),
        thumbnail: z
            .object({
                url: z.string().url().openapi({
                    description: "The URL for the thumbnail image.",
                    example:
                        "https://files.mastodon.social/site_uploads/files/000/000/001/@1x/57c12f441d083cde.png",
                }),
                blurhash: z.string().optional().openapi({
                    description:
                        "A hash computed by the BlurHash algorithm, for generating colorful preview thumbnails when media has not been downloaded yet.",
                    example: "UUKJMXv|x]t7^*t7Rjaz^jazRjaz",
                }),
                versions: z
                    .object({
                        "@1x": z.string().url().optional().openapi({
                            description:
                                "The URL for the thumbnail image at 1x resolution.",
                        }),
                        "@2x": z.string().url().optional().openapi({
                            description:
                                "The URL for the thumbnail image at 2x resolution.",
                        }),
                    })
                    .optional()
                    .openapi({
                        description:
                            "Links to scaled resolution images, for high DPI screens.",
                    }),
            })
            .openapi({
                description: "An image used to represent this instance.",
            }),
        icon: z.array(InstanceIcon).openapi({
            description:
                "The list of available size variants for this instance configured icon.",
        }),
        languages: z.array(iso631).openapi({
            description: "Primary languages of the website and its staff.",
            example: ["en"],
        }),
        configuration: z
            .object({
                urls: z
                    .object({
                        streaming: z.string().url().openapi({
                            description:
                                "The Websockets URL for connecting to the streaming API.",
                            example: "wss://versia.social",
                        }),
                    })
                    .openapi({
                        description: "URLs of interest for clients apps.",
                    }),
                vapid: z
                    .object({
                        public_key: z.string().openapi({
                            description:
                                "The instance's VAPID public key, used for push notifications, the same as WebPushSubscription#server_key.",
                            example:
                                "BCkMmVdKDnKYwzVCDC99Iuc9GvId-x7-kKtuHnLgfF98ENiZp_aj-UNthbCdI70DqN1zUVis-x0Wrot2sBagkMc=",
                        }),
                    })
                    .openapi({ description: "VAPID configuration." }),
                accounts: z
                    .object({
                        max_featured_tags: z.number().openapi({
                            description:
                                "The maximum number of featured tags allowed for each account.",
                            example: 10,
                        }),
                        max_pinned_statuses: z.number().openapi({
                            description:
                                "The maximum number of pinned statuses for each account.",
                            example: 4,
                        }),
                        /* Versia Server API extension */
                        max_displayname_characters: z.number().openapi({
                            description:
                                "The maximum number of characters allowed in a display name.",
                            example: 30,
                        }),
                        /* Versia Server API extension */
                        max_username_characters: z.number().openapi({
                            description:
                                "The maximum number of characters allowed in a username.",
                            example: 30,
                        }),
                        /* Versia Server API extension */
                        max_note_characters: z.number().openapi({
                            description:
                                "The maximum number of characters allowed in an account's bio/note.",
                            example: 500,
                        }),
                        /* Versia Server API extension */
                        avatar_limit: z.number().openapi({
                            description:
                                "The maximum size of an avatar image, in bytes.",
                            example: 1048576,
                        }),
                        /* Versia Server API extension */
                        header_limit: z.number().openapi({
                            description:
                                "The maximum size of a header image, in bytes.",
                            example: 2097152,
                        }),
                        /* Versia Server API extension */
                        fields: z
                            .object({
                                max_fields: z.number().openapi({
                                    description:
                                        "The maximum number of fields allowed per account.",
                                    example: 4,
                                }),
                                max_name_characters: z.number().openapi({
                                    description:
                                        "The maximum number of characters allowed in a field name.",
                                    example: 30,
                                }),
                                max_value_characters: z.number().openapi({
                                    description:
                                        "The maximum number of characters allowed in a field value.",
                                    example: 100,
                                }),
                            })
                            .openapi({
                                description:
                                    "Limits related to account fields.",
                            }),
                    })
                    .openapi({ description: "Limits related to accounts." }),
                statuses: z
                    .object({
                        max_characters: z.number().openapi({
                            description:
                                "The maximum number of allowed characters per status.",
                            example: 500,
                        }),
                        max_media_attachments: z.number().openapi({
                            description:
                                "The maximum number of media attachments that can be added to a status.",
                            example: 4,
                        }),
                        characters_reserved_per_url: z.number().openapi({
                            description:
                                "Each URL in a status will be assumed to be exactly this many characters.",
                            example: 23,
                        }),
                    })
                    .openapi({
                        description: "Limits related to authoring statuses.",
                    }),
                media_attachments: z
                    .object({
                        supported_mime_types: z.array(z.string()).openapi({
                            description:
                                "Contains MIME types that can be uploaded.",
                            example: ["image/jpeg", "image/png", "image/gif"],
                        }),
                        description_limit: z.number().openapi({
                            description:
                                "The maximum size of a description, in characters.",
                            example: 1500,
                        }),
                        image_size_limit: z.number().openapi({
                            description:
                                "The maximum size of any uploaded image, in bytes.",
                            example: 10485760,
                        }),
                        image_matrix_limit: z.number().openapi({
                            description:
                                "The maximum number of pixels (width times height) for image uploads.",
                            example: 16777216,
                        }),
                        video_size_limit: z.number().openapi({
                            description:
                                "The maximum size of any uploaded video, in bytes.",
                            example: 41943040,
                        }),
                        video_frame_rate_limit: z.number().openapi({
                            description:
                                "The maximum frame rate for any uploaded video.",
                            example: 60,
                        }),
                        video_matrix_limit: z.number().openapi({
                            description:
                                "The maximum number of pixels (width times height) for video uploads.",
                            example: 2304000,
                        }),
                    })
                    .openapi({
                        description:
                            "Hints for which attachments will be accepted.",
                    }),
                /* Versia Server API extension */
                emojis: z
                    .object({
                        emoji_size_limit: z.number().openapi({
                            description:
                                "The maximum size of an emoji image, in bytes.",
                            example: 1048576,
                        }),
                        max_shortcode_characters: z.number().openapi({
                            description:
                                "The maximum number of characters allowed in an emoji shortcode.",
                            example: 30,
                        }),
                        max_description_characters: z.number().openapi({
                            description:
                                "The maximum number of characters allowed in an emoji description.",
                            example: 100,
                        }),
                    })
                    .openapi({
                        description: "Limits related to custom emojis.",
                    }),
                polls: z
                    .object({
                        max_options: z.number().openapi({
                            description:
                                "Each poll is allowed to have up to this many options.",
                            example: 4,
                        }),
                        max_characters_per_option: z.number().openapi({
                            description:
                                "Each poll option is allowed to have this many characters.",
                            example: 50,
                        }),
                        min_expiration: z.number().openapi({
                            description:
                                "The shortest allowed poll duration, in seconds.",
                            example: 300,
                        }),
                        max_expiration: z.number().openapi({
                            description:
                                "The longest allowed poll duration, in seconds.",
                            example: 2629746,
                        }),
                    })
                    .openapi({ description: "Limits related to polls." }),
                translation: z
                    .object({
                        enabled: z.boolean().openapi({
                            description:
                                "Whether the Translations API is available on this instance.",
                            example: true,
                        }),
                    })
                    .openapi({ description: "Hints related to translation." }),
            })
            .openapi({
                description: "Configured values and limits for this website.",
            }),
        registrations: z
            .object({
                enabled: z.boolean().openapi({
                    description: "Whether registrations are enabled.",
                    example: false,
                }),
                approval_required: z.boolean().openapi({
                    description:
                        "Whether registrations require moderator approval.",
                    example: false,
                }),
                message: z.string().nullable().openapi({
                    description:
                        "A custom message to be shown when registrations are closed.",
                }),
            })
            .openapi({
                description: "Information about registering for this website.",
            }),
        api_versions: z
            .object({
                mastodon: z.number().openapi({
                    description:
                        "API version number that this server implements.",
                    example: 1,
                }),
            })
            .openapi({
                description:
                    "Information about which version of the API is implemented by this server.",
            }),
        contact: z
            .object({
                email: z.string().email().openapi({
                    description:
                        "An email address that can be messaged regarding inquiries or issues.",
                    example: "contact@versia.social",
                }),
                account: Account.nullable().openapi({
                    description:
                        "An account that can be contacted regarding inquiries or issues.",
                }),
            })
            .openapi({
                description:
                    "Hints related to contacting a representative of the website.",
            }),
        rules: z.array(Rule).openapi({
            description: "An itemized list of rules for this website.",
        }),
        /* Versia Server API extension */
        sso: SSOConfig,
    })
    .openapi({
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Instance",
        },
        ref: "Instance",
    });
