import {
    Account as AccountSchema,
    Notification as NotificationSchema,
    RolePermission,
    zBoolean,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Timeline } from "@versia-server/kit/db";
import { Notifications } from "@versia-server/kit/tables";
import { and, eq, gt, gte, inArray, lt, not, sql } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.get(
        "/api/v1/notifications",
        describeRoute({
            summary: "Get all notifications",
            description: "Notifications concerning the user.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/notifications/#get",
            },
            tags: ["Notifications"],
            responses: {
                200: {
                    description: "Notifications",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(NotificationSchema)),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnNotifications,
                RolePermission.ViewPrivateTimelines,
            ],
        }),
        validator(
            "query",
            z
                .object({
                    max_id: NotificationSchema.shape.id.optional().meta({
                        description:
                            "All results returned will be lesser than this ID. In effect, sets an upper bound on results.",
                        example: "8d35243d-b959-43e2-8bac-1a9d4eaea2aa",
                    }),
                    since_id: NotificationSchema.shape.id.optional().meta({
                        description:
                            "All results returned will be greater than this ID. In effect, sets a lower bound on results.",
                        example: undefined,
                    }),
                    min_id: NotificationSchema.shape.id.optional().meta({
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
                        .meta({
                            description: "Maximum number of results to return.",
                        }),
                    types: z
                        .array(NotificationSchema.shape.type)
                        .optional()
                        .meta({
                            description: "Types to include in the result.",
                        }),
                    exclude_types: z
                        .array(NotificationSchema.shape.type)
                        .optional()
                        .meta({
                            description: "Types to exclude from the results.",
                        }),
                    account_id: AccountSchema.shape.id.optional().meta({
                        description:
                            "Return only notifications received from the specified account.",
                    }),
                    // TODO: Implement
                    include_filtered: zBoolean.default(false).meta({
                        description:
                            "Whether to include notifications filtered by the user's NotificationPolicy.",
                    }),
                })
                .refine((val) => {
                    // Can't use both exclude_types and types
                    return !(val.exclude_types && val.types);
                }, "Can't use both exclude_types and types"),
            handleZodError,
        ),
        async (context) => {
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
        },
    ),
);
