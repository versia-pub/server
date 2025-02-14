import { apiRoute } from "@/api";
import { proxyUrl } from "@/response";
import { createRoute } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { Instance as InstanceSchema } from "~/classes/schemas/instance";
import pkg from "~/package.json";
import { config } from "~/packages/config-manager";

const route = createRoute({
    method: "get",
    path: "/api/v2/instance",
    summary: "View server information",
    description: "Obtain general information about the server.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/instance/#v2",
    },
    tags: ["Instance"],
    responses: {
        200: {
            description: "Server information",
            content: {
                "application/json": {
                    schema: InstanceSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        // Get first admin, or first user if no admin exists
        const contactAccount =
            (await User.fromSql(
                and(isNull(Users.instanceId), eq(Users.isAdmin, true)),
            )) ?? (await User.fromSql(isNull(Users.instanceId)));

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
            domain: config.http.base_url.hostname,
            title: config.instance.name,
            version: "4.3.0-alpha.3+glitch",
            versia_version: pkg.version,
            source_url: pkg.repository.url,
            description: config.instance.description,
            usage: {
                users: {
                    active_month: monthlyActiveUsers,
                },
            },
            api_versions: {
                mastodon: 1,
            },
            thumbnail: {
                url: config.instance.logo
                    ? proxyUrl(config.instance.logo).toString()
                    : pkg.icon,
            },
            banner: {
                url: config.instance.banner
                    ? proxyUrl(config.instance.banner).toString()
                    : null,
            },
            icon: [],
            languages: ["en"],
            configuration: {
                urls: {
                    // TODO: Implement Streaming API
                    streaming: "",
                },
                vapid: {
                    // TODO: Fill in vapid values
                    public_key: "",
                },
                accounts: {
                    max_featured_tags: 100,
                    max_displayname_characters:
                        config.validation.max_displayname_size,
                    avatar_limit: config.validation.max_avatar_size,
                    header_limit: config.validation.max_header_size,
                    max_username_characters:
                        config.validation.max_username_size,
                    max_note_characters: config.validation.max_bio_size,
                    max_pinned_statuses: 100,
                    fields: {
                        max_fields: config.validation.max_field_count,
                        max_name_characters:
                            config.validation.max_field_name_size,
                        max_value_characters:
                            config.validation.max_field_value_size,
                    },
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
                    description_limit:
                        config.validation.max_media_description_size,
                },
                emojis: {
                    emoji_size_limit: config.validation.max_emoji_size,
                    max_shortcode_characters:
                        config.validation.max_emoji_shortcode_size,
                    max_description_characters:
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
            },
            contact: {
                // TODO: Add contact email
                email: "",
                account: (contactAccount as User)?.toApi(),
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
