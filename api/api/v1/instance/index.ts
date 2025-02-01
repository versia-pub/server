import { apiRoute, auth } from "@/api";
import { proxyUrl } from "@/response";
import { createRoute, z } from "@hono/zod-openapi";
import { Instance, Note, User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import manifest from "~/package.json";
import { config } from "~/packages/config-manager";

const route = createRoute({
    method: "get",
    path: "/api/v1/instance",
    summary: "Get instance information",
    middleware: [
        auth({
            auth: false,
        }),
    ],
    responses: {
        200: {
            description: "Instance information",
            content: {
                // TODO: Add schemas for this response
                "application/json": {
                    schema: z.any(),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        // Get software version from package.json
        const version = manifest.version;

        const statusCount = await Note.getCount();

        const userCount = await User.getCount();

        const contactAccount = await User.fromSql(
            and(isNull(Users.instanceId), eq(Users.isAdmin, true)),
        );

        const knownDomainsCount = await Instance.getCount();

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
            approval_required: false,
            configuration: {
                polls: {
                    max_characters_per_option:
                        config.validation.max_poll_option_size,
                    max_expiration: config.validation.max_poll_duration,
                    max_options: config.validation.max_poll_options,
                    min_expiration: config.validation.min_poll_duration,
                },
                statuses: {
                    characters_reserved_per_url: 0,
                    max_characters: config.validation.max_note_size,
                    max_media_attachments:
                        config.validation.max_media_attachments,
                },
                media_attachments: {
                    supported_mime_types: config.validation.allowed_mime_types,
                    image_size_limit: config.validation.max_media_size,
                    image_matrix_limit: config.validation.max_media_size,
                    video_size_limit: config.validation.max_media_size,
                    video_frame_rate_limit: config.validation.max_media_size,
                    video_matrix_limit: config.validation.max_media_size,
                },
                accounts: {
                    max_featured_tags: 100,
                },
            },
            description: config.instance.description,
            email: "",
            invites_enabled: false,
            registrations: config.signups.registration,
            languages: ["en"],
            rules: config.signups.rules.map((r, index) => ({
                id: String(index),
                text: r,
            })),
            stats: {
                domain_count: knownDomainsCount,
                status_count: statusCount,
                user_count: userCount,
            },
            thumbnail: config.instance.logo
                ? proxyUrl(config.instance.logo).toString()
                : null,
            banner: config.instance.banner
                ? proxyUrl(config.instance.banner).toString()
                : null,
            title: config.instance.name,
            uri: config.http.base_url,
            urls: {
                streaming_api: "",
            },
            version: "4.3.0-alpha.3+glitch",
            versia_version: version,
            // TODO: Put into plugin directly
            sso: {
                forced: oidcConfig?.forced ?? false,
                providers:
                    oidcConfig?.providers?.map((p) => ({
                        name: p.name,
                        icon: p.icon
                            ? proxyUrl(new URL(p.icon)).toString()
                            : undefined,
                        id: p.id,
                    })) ?? [],
            },
            contact_account: contactAccount?.toApi() || undefined,
        } satisfies Record<string, unknown> & {
            banner: string | null;
            versia_version: string;
            sso: {
                forced: boolean;
                providers: {
                    id: string;
                    name: string;
                    icon?: string;
                }[];
            };
        });
    }),
);
