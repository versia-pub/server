import { InstanceV1 as InstanceV1Schema } from "@versia/client/schemas";
import { Instance, Note, User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import type { z } from "zod";
import { apiRoute } from "@/api";
import { markdownParse } from "~/classes/functions/status";
import { config } from "~/config.ts";
import manifest from "~/package.json" with { type: "json" };

export default apiRoute((app) =>
    app.get(
        "/api/v1/instance",
        describeRoute({
            summary: "View server information (v1)",
            description:
                "Obtain general information about the server. See api/v2/instance instead.",
            deprecated: true,
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/instance/#v1",
            },
            tags: ["Instance"],
            responses: {
                200: {
                    description: "Instance information",
                    content: {
                        "application/json": {
                            schema: resolver(InstanceV1Schema),
                        },
                    },
                },
            },
        }),
        async (context) => {
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
                          icon?: string;
                      }[];
                  }
                | undefined;

            const content = await markdownParse(
                config.instance.extended_description_path?.content ??
                    "This is a [Versia](https://versia.pub) server with the default extended description.",
            );

            return context.json({
                approval_required: config.registration.require_approval,
                configuration: {
                    polls: {
                        max_characters_per_option:
                            config.validation.polls.max_option_characters,
                        max_expiration:
                            config.validation.polls.max_duration_seconds,
                        max_options: config.validation.polls.max_options,
                        min_expiration:
                            config.validation.polls.min_duration_seconds,
                    },
                    statuses: {
                        characters_reserved_per_url: 0,
                        max_characters: config.validation.notes.max_characters,
                        max_media_attachments:
                            config.validation.notes.max_attachments,
                    },
                    media_attachments: {
                        supported_mime_types:
                            config.validation.media.allowed_mime_types,
                        image_size_limit: config.validation.media.max_bytes,
                        // TODO: Implement
                        image_matrix_limit: 1 ** 10,
                        video_size_limit: 1 ** 10,
                        video_frame_rate_limit: 60,
                        video_matrix_limit: 1 ** 10,
                    },
                    accounts: {
                        max_featured_tags: 100,
                    },
                },
                short_description: config.instance.description,
                description: content,
                email: config.instance.contact.email,
                invites_enabled: false,
                registrations: config.registration.allow,
                languages: config.instance.languages,
                rules: config.instance.rules.map((r, index) => ({
                    id: String(index),
                    text: r.text,
                    hint: r.hint,
                })),
                stats: {
                    domain_count: knownDomainsCount,
                    status_count: statusCount,
                    user_count: userCount,
                },
                thumbnail: config.instance.branding.logo?.proxied ?? null,
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
                            icon: p.icon,
                            id: p.id,
                        })) ?? [],
                },
                contact_account: (contactAccount as User)?.toApi(),
            } satisfies z.infer<typeof InstanceV1Schema>);
        },
    ),
);
