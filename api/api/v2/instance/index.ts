import { apiRoute } from "@/api";
import { proxyUrl } from "@/response";
import { createRoute, z } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { Account } from "~/classes/schemas/account";
import manifest from "~/package.json";
import { config } from "~/packages/config-manager";

const route = createRoute({
    method: "get",
    path: "/api/v2/instance",
    summary: "Get instance metadata",
    responses: {
        200: {
            description: "Instance metadata",
            content: {
                "application/json": {
                    schema: z.object({
                        domain: z.string(),
                        title: z.string(),
                        version: z.string(),
                        versia_version: z.string(),
                        source_url: z.string(),
                        description: z.string(),
                        usage: z.object({
                            users: z.object({
                                active_month: z.number(),
                            }),
                        }),
                        thumbnail: z.object({
                            url: z.string().nullable(),
                        }),
                        banner: z.object({
                            url: z.string().nullable(),
                        }),
                        languages: z.array(z.string()),
                        configuration: z.object({
                            urls: z.object({
                                streaming: z.string().nullable(),
                                status: z.string().nullable(),
                            }),
                            accounts: z.object({
                                max_featured_tags: z.number(),
                                max_displayname_characters: z.number(),
                                avatar_size_limit: z.number(),
                                header_size_limit: z.number(),
                                max_fields_name_characters: z.number(),
                                max_fields_value_characters: z.number(),
                                max_fields: z.number(),
                                max_username_characters: z.number(),
                                max_note_characters: z.number(),
                            }),
                            statuses: z.object({
                                max_characters: z.number(),
                                max_media_attachments: z.number(),
                                characters_reserved_per_url: z.number(),
                            }),
                            media_attachments: z.object({
                                supported_mime_types: z.array(z.string()),
                                image_size_limit: z.number(),
                                image_matrix_limit: z.number(),
                                video_size_limit: z.number(),
                                video_frame_rate_limit: z.number(),
                                video_matrix_limit: z.number(),
                                max_description_characters: z.number(),
                            }),
                            polls: z.object({
                                max_characters_per_option: z.number(),
                                max_expiration: z.number(),
                                max_options: z.number(),
                                min_expiration: z.number(),
                            }),
                            translation: z.object({
                                enabled: z.boolean(),
                            }),
                        }),
                        registrations: z.object({
                            enabled: z.boolean(),
                            approval_required: z.boolean(),
                            message: z.string().nullable(),
                            url: z.string().nullable(),
                        }),
                        contact: z.object({
                            email: z.string().nullable(),
                            account: Account.nullable(),
                        }),
                        rules: z.array(
                            z.object({
                                id: z.string(),
                                text: z.string(),
                                hint: z.string(),
                            }),
                        ),
                        sso: z.object({
                            forced: z.boolean(),
                            providers: z.array(
                                z.object({
                                    name: z.string(),
                                    icon: z.string(),
                                    id: z.string(),
                                }),
                            ),
                        }),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        // Get software version from package.json
        const version = manifest.version;

        const contactAccount = await User.fromSql(
            and(isNull(Users.instanceId), eq(Users.isAdmin, true)),
        );

        const monthlyActiveUsers = await User.getActiveInPeriod(
            30 * 24 * 60 * 60 * 1000,
        );

        const oidcConfig = config.plugins?.config?.["@versia/openid"] as
            | {
                  forced?: boolean;
                  providers?: {
                      id: string;
                      name: string;
                      icon: string;
                  }[];
              }
            | undefined;

        // TODO: fill in more values
        return context.json({
            domain: new URL(config.http.base_url).hostname,
            title: config.instance.name,
            version: "4.3.0-alpha.3+glitch",
            versia_version: version,
            source_url: "https://github.com/versia-pub/server",
            description: config.instance.description,
            usage: {
                users: {
                    active_month: monthlyActiveUsers,
                },
            },
            thumbnail: {
                url: config.instance.logo
                    ? proxyUrl(config.instance.logo)
                    : null,
            },
            banner: {
                url: config.instance.banner
                    ? proxyUrl(config.instance.banner)
                    : null,
            },
            languages: ["en"],
            configuration: {
                urls: {
                    streaming: null,
                    status: null,
                },
                accounts: {
                    max_featured_tags: 100,
                    max_displayname_characters:
                        config.validation.max_displayname_size,
                    avatar_size_limit: config.validation.max_avatar_size,
                    header_size_limit: config.validation.max_header_size,
                    max_fields_name_characters:
                        config.validation.max_field_name_size,
                    max_fields_value_characters:
                        config.validation.max_field_value_size,
                    max_fields: config.validation.max_field_count,
                    max_username_characters:
                        config.validation.max_username_size,
                    max_note_characters: config.validation.max_bio_size,
                },
                statuses: {
                    max_characters: config.validation.max_note_size,
                    max_media_attachments:
                        config.validation.max_media_attachments,
                    characters_reserved_per_url: 0,
                },
                media_attachments: {
                    supported_mime_types: config.validation.allowed_mime_types,
                    image_size_limit: config.validation.max_media_size,
                    image_matrix_limit: config.validation.max_media_size,
                    video_size_limit: config.validation.max_media_size,
                    video_frame_rate_limit: config.validation.max_media_size,
                    video_matrix_limit: config.validation.max_media_size,
                    max_description_characters:
                        config.validation.max_media_description_size,
                },
                emojis: {
                    emoji_size_limit: config.validation.max_emoji_size,
                    max_emoji_shortcode_characters:
                        config.validation.max_emoji_shortcode_size,
                    max_emoji_description_characters:
                        config.validation.max_emoji_description_size,
                },
                polls: {
                    max_characters_per_option:
                        config.validation.max_poll_option_size,
                    max_expiration: config.validation.max_poll_duration,
                    max_options: config.validation.max_poll_options,
                    min_expiration: config.validation.min_poll_duration,
                },
                translation: {
                    enabled: false,
                },
            },
            registrations: {
                enabled: config.signups.registration,
                approval_required: false,
                message: null,
                url: null,
            },
            contact: {
                email: contactAccount?.data.email || null,
                account: contactAccount?.toApi() || null,
            },
            rules: config.signups.rules.map((rule, index) => ({
                id: String(index),
                text: rule,
                hint: "",
            })),
            sso: {
                forced: oidcConfig?.forced ?? false,
                providers:
                    oidcConfig?.providers?.map((p) => ({
                        name: p.name,
                        icon: p.icon ? proxyUrl(new URL(p.icon)) : "",
                        id: p.id,
                    })) ?? [],
            },
        });
    }),
);
