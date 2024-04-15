import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";
import { and, count, countDistinct, eq, gte, isNull } from "drizzle-orm";
import { findFirstUser, userToAPI } from "~database/entities/User";
import { db } from "~drizzle/db";
import { instance, status, user } from "~drizzle/schema";
import manifest from "~package.json";
import type { Instance as APIInstance } from "~types/mastodon/instance";

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

export default apiRoute(async (req, matchedRoute, extraData) => {
    const config = await extraData.configManager.getConfig();

    // Get software version from package.json
    const version = manifest.version;
    const contactAccount = await findFirstUser({
        where: (user, { isNull, eq, and }) =>
            and(isNull(user.instanceId), eq(user.isAdmin, true)),
        orderBy: (user, { asc }) => asc(user.id),
    });

    const monthlyActiveUsers = (
        await db
            .select({
                count: countDistinct(user),
            })
            .from(user)
            .leftJoin(status, eq(user.id, status.authorId))
            .where(
                and(
                    isNull(user.instanceId),
                    gte(
                        status.createdAt,
                        new Date(
                            Date.now() - 30 * 24 * 60 * 60 * 1000,
                        ).toISOString(),
                    ),
                ),
            )
    )[0].count;

    // TODO: fill in more values
    return jsonResponse({
        domain: new URL(config.http.base_url).hostname,
        title: config.instance.name,
        version: `4.3.0+glitch (compatible; Lysand ${version}})`,
        source_url: "https://github.com/lysand-org/lysand",
        description: config.instance.description,
        usage: {
            users: {
                active_month: monthlyActiveUsers,
            },
        },
        thumbnail: {
            url: config.instance.logo,
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
                max_media_attachments: config.validation.max_media_attachments,
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
            email: contactAccount?.email || null,
            account: contactAccount ? userToAPI(contactAccount) : null,
        },
        rules: [],
    });
});
