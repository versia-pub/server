import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Timeline } from "@versia/kit/db";
import { Notifications, RolePermissions } from "@versia/kit/tables";
import { and, eq, gt, gte, inArray, lt, not, sql } from "drizzle-orm";
import { Account as AccountSchema } from "~/classes/schemas/account";
import { Notification as NotificationSchema } from "~/classes/schemas/notification.ts";

const schemas = {
    query: z
        .object({
            max_id: NotificationSchema.shape.id.optional(),
            since_id: NotificationSchema.shape.id.optional(),
            min_id: NotificationSchema.shape.id.optional(),
            limit: z.coerce.number().int().min(1).max(80).default(15),
            exclude_types: z.array(NotificationSchema.shape.type).optional(),
            types: z.array(NotificationSchema.shape.type).optional(),
            account_id: AccountSchema.shape.id.optional(),
        })
        .refine((val) => {
            // Can't use both exclude_types and types
            return !(val.exclude_types && val.types);
        }, "Can't use both exclude_types and types"),
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
                    schema: z.array(NotificationSchema),
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
            new URL(context.req.url),
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
