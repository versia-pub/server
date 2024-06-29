import { applyConfig, auth } from "@/api";
import { jsonResponse, proxyUrl } from "@/response";
import { and, count, eq, isNull } from "drizzle-orm";
import type { Hono } from "hono";
import { db } from "~/drizzle/db";
import { Instances, Users } from "~/drizzle/schema";
import manifest from "~/package.json";
import { config } from "~/packages/config-manager";
import { Note } from "~/packages/database-interface/note";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/instance",
    ratelimits: {
        max: 300,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async () => {
            // Get software version from package.json
            const version = manifest.version;

            const statusCount = await Note.getCount();

            const userCount = await User.getCount();

            const contactAccount = await User.fromSql(
                and(isNull(Users.instanceId), eq(Users.isAdmin, true)),
            );

            const knownDomainsCount = (
                await db
                    .select({
                        count: count(),
                    })
                    .from(Instances)
            )[0].count;

            // TODO: fill in more values
            return jsonResponse({
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
                thumbnail: proxyUrl(config.instance.logo),
                banner: proxyUrl(config.instance.banner),
                title: config.instance.name,
                uri: config.http.base_url,
                urls: {
                    streaming_api: "",
                },
                version: "4.3.0-alpha.3+glitch",
                lysand_version: version,
                sso: {
                    forced: false,
                    providers: config.oidc.providers.map((p) => ({
                        name: p.name,
                        icon: proxyUrl(p.icon) || undefined,
                        id: p.id,
                    })),
                },
                contact_account: contactAccount?.toApi() || undefined,
            } satisfies Record<string, unknown> & {
                banner: string | null;
                lysand_version: string;
                sso: {
                    forced: boolean;
                    providers: {
                        id: string;
                        name: string;
                        icon?: string;
                    }[];
                };
            });
        },
    );
