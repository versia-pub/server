import { apiRoute } from "@/api";
import { proxyUrl } from "@/response";
import { createRoute } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { Instance as InstanceSchema } from "~/classes/schemas/instance";
import { config } from "~/config.ts";
import pkg from "~/package.json";

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
                url: config.instance.branding.logo
                    ? proxyUrl(config.instance.branding.logo).toString()
                    : pkg.icon,
            },
            banner: {
                url: config.instance.branding.banner
                    ? proxyUrl(config.instance.branding.banner).toString()
                    : null,
            },
            icon: [],
            languages: config.instance.languages,
            configuration: {
                urls: {
                    // TODO: Implement Streaming API
                    streaming: "",
                },
                vapid: {
                    public_key:
                        config.notifications.push?.vapid_keys.public ?? "",
                },
                accounts: {
                    max_featured_tags: 100,
                    max_displayname_characters:
                        config.validation.accounts.max_displayname_characters,
                    avatar_limit: config.validation.accounts.max_avatar_bytes,
                    header_limit: config.validation.accounts.max_header_bytes,
                    max_username_characters:
                        config.validation.accounts.max_username_characters,
                    max_note_characters:
                        config.validation.accounts.max_bio_characters,
                    max_pinned_statuses:
                        config.validation.accounts.max_pinned_notes,
                    fields: {
                        max_fields: config.validation.accounts.max_field_count,
                        max_name_characters:
                            config.validation.accounts
                                .max_field_name_characters,
                        max_value_characters:
                            config.validation.accounts
                                .max_field_value_characters,
                    },
                },
                statuses: {
                    max_characters: config.validation.notes.max_characters,
                    max_media_attachments:
                        config.validation.notes.max_attachments,
                    // TODO: Implement
                    characters_reserved_per_url: 13,
                },
                media_attachments: {
                    supported_mime_types:
                        config.validation.media.allowed_mime_types,
                    image_size_limit: config.validation.media.max_bytes,
                    image_matrix_limit: 1 ** 10,
                    video_size_limit: 1 ** 10,
                    video_frame_rate_limit: 60,
                    video_matrix_limit: 1 ** 10,
                    description_limit:
                        config.validation.media.max_description_characters,
                },
                emojis: {
                    emoji_size_limit: config.validation.emojis.max_bytes,
                    max_shortcode_characters:
                        config.validation.emojis.max_shortcode_characters,
                    max_description_characters:
                        config.validation.emojis.max_description_characters,
                },
                polls: {
                    max_characters_per_option:
                        config.validation.polls.max_option_characters,
                    max_expiration:
                        config.validation.polls.max_duration_seconds,
                    max_options: config.validation.polls.max_options,
                    min_expiration:
                        config.validation.polls.min_duration_seconds,
                },
                translation: {
                    enabled: false,
                },
            },
            registrations: {
                enabled: config.registration.allow,
                approval_required: config.registration.require_approval,
                message: config.registration.message ?? null,
            },
            contact: {
                email: config.instance.contact.email,
                account: (contactAccount as User)?.toApi(),
            },
            rules: config.instance.rules.map((r, index) => ({
                id: String(index),
                text: r.text,
                hint: r.hint,
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
