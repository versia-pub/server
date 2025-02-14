import { apiRoute, auth } from "@/api";
import { renderMarkdownInPath } from "@/markdown";
import { proxyUrl } from "@/response";
import { createRoute, type z } from "@hono/zod-openapi";
import { Instance, Note, User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { InstanceV1 as InstanceV1Schema } from "~/classes/schemas/instance-v1";
import manifest from "~/package.json";
import { config } from "~/packages/config-manager";

const route = createRoute({
    method: "get",
    path: "/api/v1/instance",
    summary: "View server information (v1)",
    description:
        "Obtain general information about the server. See api/v2/instance instead.",
    deprecated: true,
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/instance/#v1",
    },
    tags: ["Instance"],
    middleware: [
        auth({
            auth: false,
        }),
    ],
    responses: {
        200: {
            description: "Instance information",
            content: {
                "application/json": {
                    schema: InstanceV1Schema,
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

        // Get first admin, or first user if no admin exists
        const contactAccount =
            (await User.fromSql(
                and(isNull(Users.instanceId), eq(Users.isAdmin, true)),
            )) ?? (await User.fromSql(isNull(Users.instanceId)));

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

        const { content } = await renderMarkdownInPath(
            config.instance.extended_description_path ?? "",
            "This is a [Versia](https://versia.pub) server with the default extended description.",
        );

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
            short_description: config.instance.description,
            description: content,
            // TODO: Add contact email
            email: "",
            invites_enabled: false,
            registrations: config.signups.registration,
            // TODO: Implement
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
            title: config.instance.name,
            uri: config.http.base_url.host,
            urls: {
                // TODO: Implement Streaming API
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
            contact_account: (contactAccount as User)?.toApi(),
        } satisfies z.infer<typeof InstanceV1Schema>);
    }),
);
