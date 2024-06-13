import { applyConfig } from "@/api";
import { jsonResponse, proxyUrl } from "@/response";
import { and, eq, isNull } from "drizzle-orm";
import type { Hono } from "hono";
import { Users } from "~/drizzle/schema";
import manifest from "~/package.json";
import { config } from "~/packages/config-manager";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v2/instance",
    ratelimits: {
        max: 300,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export default (app: Hono) =>
    app.on(meta.allowedMethods, meta.route, async (_context) => {
        // Get software version from package.json
        const version = manifest.version;

        const contactAccount = await User.fromSql(
            and(isNull(Users.instanceId), eq(Users.isAdmin, true)),
        );

        const monthlyActiveUsers = await User.getActiveInPeriod(
            30 * 24 * 60 * 60 * 1000,
        );

        // TODO: fill in more values
        return jsonResponse({
            domain: new URL(config.http.base_url).hostname,
            title: config.instance.name,
            version: "4.3.0-alpha.3+glitch",
            lysand_version: version,
            source_url: "https://github.com/lysand-org/lysand",
            description: config.instance.description,
            usage: {
                users: {
                    active_month: monthlyActiveUsers,
                },
            },
            thumbnail: {
                url: proxyUrl(config.instance.logo),
            },
            banner: {
                url: proxyUrl(config.instance.banner),
            },
            languages: ["en"],
            configuration: {
                urls: {
                    streaming: null,
                    status: null,
                },
                accounts: {
                    max_featured_tags: 100,
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
                forced: false,
                providers: config.oidc.providers.map((p) => ({
                    name: p.name,
                    icon: p.icon,
                    id: p.id,
                })),
            },
        });
    });
