import { apiRoute, applyConfig, auth, idValidator } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Notification, Timeline } from "@versia/kit/db";
import { Notifications, RolePermissions } from "@versia/kit/tables";
import { and, eq, gt, gte, inArray, lt, not, sql } from "drizzle-orm";
import { z } from "zod";

export const meta = applyConfig({
    route: "/api/v1/notifications",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:notifications"],
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnNotifications,
            RolePermissions.ViewPrivateTimelines,
        ],
    },
});

export const schemas = {
    query: z
        .object({
            max_id: z.string().regex(idValidator).optional(),
            since_id: z.string().regex(idValidator).optional(),
            min_id: z.string().regex(idValidator).optional(),
            limit: z.coerce.number().int().min(1).max(80).default(15),
            exclude_types: z
                .enum([
                    "mention",
                    "status",
                    "follow",
                    "follow_request",
                    "reblog",
                    "poll",
                    "favourite",
                    "update",
                    "admin.sign_up",
                    "admin.report",
                    "chat",
                    "pleroma:chat_mention",
                    "pleroma:emoji_reaction",
                    "pleroma:event_reminder",
                    "pleroma:participation_request",
                    "pleroma:participation_accepted",
                    "move",
                    "group_reblog",
                    "group_favourite",
                    "user_approved",
                ])
                .array()
                .optional(),
            types: z
                .enum([
                    "mention",
                    "status",
                    "follow",
                    "follow_request",
                    "reblog",
                    "poll",
                    "favourite",
                    "update",
                    "admin.sign_up",
                    "admin.report",
                    "chat",
                    "pleroma:chat_mention",
                    "pleroma:emoji_reaction",
                    "pleroma:event_reminder",
                    "pleroma:participation_request",
                    "pleroma:participation_accepted",
                    "move",
                    "group_reblog",
                    "group_favourite",
                    "user_approved",
                ])
                .array()
                .optional(),
            account_id: z.string().regex(idValidator).optional(),
        })
        .refine((val) => {
            // Can't use both exclude_types and types
            return !(val.exclude_types && val.types);
        }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/notifications",
    summary: "Get notifications",
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnNotifications,
                RolePermissions.ViewPrivateTimelines,
            ],
        }),
    ] as const,
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Notifications",
            content: {
                "application/json": {
                    schema: z.array(Notification.schema),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        const {
            account_id,
            exclude_types,
            limit,
            max_id,
            min_id,
            since_id,
            types,
        } = context.req.valid("query");

        const { objects, link } = await Timeline.getNotificationTimeline(
            and(
                max_id ? lt(Notifications.id, max_id) : undefined,
                since_id ? gte(Notifications.id, since_id) : undefined,
                min_id ? gt(Notifications.id, min_id) : undefined,
                eq(Notifications.notifiedId, user.id),
                eq(Notifications.dismissed, false),
                account_id
                    ? eq(Notifications.accountId, account_id)
                    : undefined,
                not(eq(Notifications.accountId, user.id)),
                types ? inArray(Notifications.type, types) : undefined,
                exclude_types
                    ? not(inArray(Notifications.type, exclude_types))
                    : undefined,
                // Don't show notes that have filtered words in them (via Notification.note.content via Notification.noteId)
                // Filters in `Filters` table have keyword in `FilterKeywords` table (use LIKE)
                // Filters table has a userId and a context which is an array
                sql`NOT EXISTS (
                    SELECT 1
                    FROM "Filters"
                    WHERE "Filters"."userId" = ${user.id}
                    AND "Filters"."filter_action" = 'hide'
                    AND EXISTS (
                        SELECT 1
                        FROM "FilterKeywords", "Notifications" as "n_inner", "Notes"
                        WHERE "FilterKeywords"."filterId" = "Filters"."id"
                        AND "n_inner"."noteId" = "Notes"."id"
                        AND "Notes"."content" LIKE
                        '%' || "FilterKeywords"."keyword" || '%'
                        AND "n_inner"."id" = "Notifications"."id"
                    )
                    AND "Filters"."context" @> ARRAY['notifications']
                )`,
            ),
            limit,
            context.req.url,
            user.id,
        );

        return context.json(
            await Promise.all(objects.map((n) => n.toApi())),
            200,
            {
                Link: link,
            },
        );
    }),
);
