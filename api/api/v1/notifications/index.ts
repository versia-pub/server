import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Timeline } from "@versia/kit/db";
import { Notifications, RolePermissions } from "@versia/kit/tables";
import { and, eq, gt, gte, inArray, lt, not, sql } from "drizzle-orm";
import { Account as AccountSchema } from "~/classes/schemas/account";
import { zBoolean } from "~/classes/schemas/common.ts";
import { Notification as NotificationSchema } from "~/classes/schemas/notification.ts";

const route = createRoute({
    method: "get",
    path: "/api/v1/notifications",
    summary: "Get all notifications",
    description: "Notifications concerning the user.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/notifications/#get",
    },
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
        query: z
            .object({
                max_id: NotificationSchema.shape.id.optional().openapi({
                    description:
                        "All results returned will be lesser than this ID. In effect, sets an upper bound on results.",
                    example: "8d35243d-b959-43e2-8bac-1a9d4eaea2aa",
                }),
                since_id: NotificationSchema.shape.id.optional().openapi({
                    description:
                        "All results returned will be greater than this ID. In effect, sets a lower bound on results.",
                    example: undefined,
                }),
                min_id: NotificationSchema.shape.id.optional().openapi({
                    description:
                        "Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.",
                    example: undefined,
                }),
                limit: z.coerce
                    .number()
                    .int()
                    .min(1)
                    .max(80)
                    .default(40)
                    .openapi({
                        description: "Maximum number of results to return.",
                    }),
                types: z
                    .array(NotificationSchema.shape.type)
                    .optional()
                    .openapi({
                        description: "Types to include in the result.",
                    }),
                exclude_types: z
                    .array(NotificationSchema.shape.type)
                    .optional()
                    .openapi({
                        description: "Types to exclude from the results.",
                    }),
                account_id: AccountSchema.shape.id.optional().openapi({
                    description:
                        "Return only notifications received from the specified account.",
                }),
                // TODO: Implement
                include_filtered: zBoolean.default(false).openapi({
                    description:
                        "Whether to include notifications filtered by the user’s NotificationPolicy.",
                }),
            })
            .refine((val) => {
                // Can't use both exclude_types and types
                return !(val.exclude_types && val.types);
            }, "Can't use both exclude_types and types"),
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
        ...reusedResponses,
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
