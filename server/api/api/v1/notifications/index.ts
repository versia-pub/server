import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
    findManyNotifications,
    notificationToAPI,
} from "~database/entities/Notification";
import type { NotificationWithRelations } from "~database/entities/Notification";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/notifications",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:notifications"],
    },
});

export const schema = z.object({
    max_id: z.string().regex(idValidator).optional(),
    since_id: z.string().regex(idValidator).optional(),
    min_id: z.string().regex(idValidator).optional(),
    limit: z.coerce.number().int().min(1).max(80).optional().default(15),
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
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { user } = extraData.auth;

        if (!user) return errorResponse("Unauthorized", 401);

        const {
            account_id,
            exclude_types,
            limit,
            max_id,
            min_id,
            since_id,
            types,
        } = extraData.parsedRequest;

        if (types && exclude_types) {
            return errorResponse("Can't use both types and exclude_types", 400);
        }

        const { objects, link } =
            await fetchTimeline<NotificationWithRelations>(
                findManyNotifications,
                {
                    where: (
                        // @ts-expect-error Yes I KNOW the types are wrong
                        notification,
                        // @ts-expect-error Yes I KNOW the types are wrong
                        { lt, gte, gt, and, eq, not, inArray },
                    ) =>
                        and(
                            max_id ? lt(notification.id, max_id) : undefined,
                            since_id
                                ? gte(notification.id, since_id)
                                : undefined,
                            min_id ? gt(notification.id, min_id) : undefined,
                            eq(notification.notifiedId, user.id),
                            eq(notification.dismissed, false),
                            account_id
                                ? eq(notification.accountId, account_id)
                                : undefined,
                            not(eq(notification.accountId, user.id)),
                            types
                                ? inArray(notification.type, types)
                                : undefined,
                            exclude_types
                                ? not(inArray(notification.type, exclude_types))
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
                                    AND "Notes"."content" LIKE '%' || "FilterKeywords"."keyword" || '%' 
                                    AND "n_inner"."id" = "Notifications"."id"
                                ) 
                                AND "Filters"."context" @> ARRAY['notifications']
                            )`,
                        ),
                    limit,
                    // @ts-expect-error Yes I KNOW the types are wrong
                    orderBy: (notification, { desc }) => desc(notification.id),
                },
                req,
            );

        return jsonResponse(
            await Promise.all(objects.map((n) => notificationToAPI(n))),
            200,
            {
                Link: link,
            },
        );
    },
);
