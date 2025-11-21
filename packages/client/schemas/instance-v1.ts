import { z } from "zod";
import { Instance } from "./instance.ts";
import { SSOConfig } from "./versia.ts";

export const InstanceV1 = z
    .object({
        uri: Instance.shape.domain,
        title: Instance.shape.title,
        short_description: Instance.shape.description,
        description: z.string().meta({
            description: "An HTML-permitted description of the site.",
            example: "<p>Join the world's smallest social network.</p>",
        }),
        email: Instance.shape.contact.shape.email,
        version: Instance.shape.version,
        /* Versia Server API extension */
        versia_version: Instance.shape.versia_version,
        urls: z
            .object({
                streaming_api:
                    Instance.shape.configuration.shape.urls.shape.streaming,
            })
            .meta({
                description: "URLs of interest for clients apps.",
            }),
        stats: z
            .object({
                user_count: z.number().meta({
                    description: "Total users on this instance.",
                    example: 812303,
                }),
                status_count: z.number().meta({
                    description: "Total statuses on this instance.",
                    example: 38151616,
                }),
                domain_count: z.number().meta({
                    description: "Total domains discovered by this instance.",
                    example: 25255,
                }),
            })
            .meta({
                description:
                    "Statistics about how much information the instance contains.",
            }),
        thumbnail: z.url().nullable().meta({
            description: "Banner image for the website.",
            example:
                "https://files.mastodon.social/site_uploads/files/000/000/001/original/vlcsnap-2018-08-27-16h43m11s127.png",
        }),
        languages: Instance.shape.languages,
        registrations: Instance.shape.registrations.shape.enabled,
        approval_required: Instance.shape.registrations.shape.approval_required,
        invites_enabled: z.boolean().meta({
            description: "Whether invites are enabled.",
            example: true,
        }),
        configuration: z
            .object({
                accounts: z
                    .object({
                        max_featured_tags:
                            Instance.shape.configuration.shape.accounts.shape
                                .max_featured_tags,
                    })
                    .meta({
                        description: "Limits related to accounts.",
                    }),
                statuses: z
                    .object({
                        max_characters:
                            Instance.shape.configuration.shape.statuses.shape
                                .max_characters,
                        max_media_attachments:
                            Instance.shape.configuration.shape.statuses.shape
                                .max_media_attachments,
                        characters_reserved_per_url:
                            Instance.shape.configuration.shape.statuses.shape
                                .characters_reserved_per_url,
                    })
                    .meta({
                        description: "Limits related to authoring statuses.",
                    }),
                media_attachments: z
                    .object({
                        supported_mime_types:
                            Instance.shape.configuration.shape.media_attachments
                                .shape.supported_mime_types,
                        image_size_limit:
                            Instance.shape.configuration.shape.media_attachments
                                .shape.image_size_limit,
                        image_matrix_limit:
                            Instance.shape.configuration.shape.media_attachments
                                .shape.image_matrix_limit,
                        video_size_limit:
                            Instance.shape.configuration.shape.media_attachments
                                .shape.video_size_limit,
                        video_frame_rate_limit:
                            Instance.shape.configuration.shape.media_attachments
                                .shape.video_frame_rate_limit,
                        video_matrix_limit:
                            Instance.shape.configuration.shape.media_attachments
                                .shape.video_matrix_limit,
                    })
                    .meta({
                        description:
                            "Hints for which attachments will be accepted.",
                    }),
                polls: z
                    .object({
                        max_options:
                            Instance.shape.configuration.shape.polls.shape
                                .max_options,
                        max_characters_per_option:
                            Instance.shape.configuration.shape.polls.shape
                                .max_characters_per_option,
                        min_expiration:
                            Instance.shape.configuration.shape.polls.shape
                                .min_expiration,
                        max_expiration:
                            Instance.shape.configuration.shape.polls.shape
                                .max_expiration,
                    })
                    .meta({
                        description: "Limits related to polls.",
                    }),
            })
            .meta({
                description: "Configured values and limits for this website.",
            }),
        contact_account: Instance.shape.contact.shape.account,
        rules: Instance.shape.rules,
        /* Versia Server API extension */
        sso: SSOConfig,
    })
    .meta({
        description:
            "Represents the software instance of Versia Server running on this domain.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/V1_Instance",
        },
        id: "InstanceV1",
    });
