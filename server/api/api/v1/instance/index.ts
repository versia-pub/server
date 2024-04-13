import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";
import { and, count, countDistinct, eq, gte, isNull } from "drizzle-orm";
import { findFirstUser, userToAPI } from "~database/entities/User";
import { db } from "~drizzle/db";
import { instance, status, user } from "~drizzle/schema";
import manifest from "~package.json";
import type { APIInstance } from "~types/entities/instance";

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

export default apiRoute(async (req, matchedRoute, extraData) => {
    const config = await extraData.configManager.getConfig();

    // Get software version from package.json
    const version = manifest.version;

    const statusCount = (
        await db
            .select({
                count: count(),
            })
            .from(status)
            .where(isNull(status.instanceId))
    )[0].count;

    const userCount = (
        await db
            .select({
                count: count(),
            })
            .from(user)
            .where(isNull(user.instanceId))
    )[0].count;

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

    const knownDomainsCount = (
        await db
            .select({
                count: count(),
            })
            .from(instance)
    )[0].count;

    // TODO: fill in more values
    return jsonResponse({
        approval_required: false,
        configuration: {
            media_attachments: {
                image_matrix_limit: config.validation.max_media_attachments,
                image_size_limit: config.validation.max_media_size,
                supported_mime_types: config.validation.allowed_mime_types,
                video_frame_limit: 60,
                video_matrix_limit: 10,
                video_size_limit: config.validation.max_media_size,
            },
            polls: {
                max_characters_per_option:
                    config.validation.max_poll_option_size,
                max_expiration: config.validation.max_poll_duration,
                max_options: config.validation.max_poll_options,
                min_expiration: 60,
            },
            statuses: {
                characters_reserved_per_url: 0,
                max_characters: config.validation.max_note_size,
                max_media_attachments: config.validation.max_media_attachments,
                supported_mime_types: [
                    "text/plain",
                    "text/markdown",
                    "text/html",
                ],
            },
        },
        description: "A test instance",
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
        thumbnail: config.instance.logo,
        tos_url: config.signups.tos_url,
        title: config.instance.name,
        uri: config.http.base_url,
        urls: {
            streaming_api: "",
        },
        version: `4.3.0+glitch (compatible; Lysand ${version}})`,
        max_toot_chars: config.validation.max_note_size,
        pleroma: {
            metadata: {
                account_activation_required: false,
                features: [
                    "pleroma_api",
                    "akkoma_api",
                    "mastodon_api",
                    // "mastodon_api_streaming",
                    // "polls",
                    // "v2_suggestions",
                    // "pleroma_explicit_addressing",
                    // "shareable_emoji_packs",
                    // "multifetch",
                    // "pleroma:api/v1/notifications:include_types_filter",
                    "quote_posting",
                    "editing",
                    // "bubble_timeline",
                    // "relay",
                    // "pleroma_emoji_reactions",
                    // "exposable_reactions",
                    // "profile_directory",
                    "custom_emoji_reactions",
                    // "pleroma:get:main/ostatus",
                ],
                federation: {
                    enabled: true,
                    exclusions: false,
                    mrf_policies: [],
                    mrf_simple: {
                        accept: [],
                        avatar_removal: [],
                        background_removal: [],
                        banner_removal: [],
                        federated_timeline_removal: [],
                        followers_only: [],
                        media_nsfw: [],
                        media_removal: [],
                        reject: [],
                        reject_deletes: [],
                        report_removal: [],
                    },
                    mrf_simple_info: {
                        media_nsfw: {},
                        reject: {},
                    },
                    quarantined_instances: [],
                    quarantined_instances_info: {
                        quarantined_instances: {},
                    },
                },
                fields_limits: {
                    max_fields: config.validation.max_field_count,
                    max_remote_fields: 9999,
                    name_length: config.validation.max_field_name_size,
                    value_length: config.validation.max_field_value_size,
                },
                post_formats: [
                    "text/plain",
                    "text/html",
                    "text/markdown",
                    "text/x.misskeymarkdown",
                ],
                privileged_staff: false,
            },
            stats: {
                mau: monthlyActiveUsers,
            },
            vapid_public_key: "",
        },
        // @ts-expect-error Sometimes there just isnt an admin
        contact_account: contactAccount ? userToAPI(contactAccount) : undefined,
    } satisfies APIInstance & {
        pleroma: object;
    });
});
