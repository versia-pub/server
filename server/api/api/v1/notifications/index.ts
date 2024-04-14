import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
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
                        { lt, gte, gt, and, or, eq, inArray, sql },
                    ) =>
                        or(
                            and(
                                max_id
                                    ? lt(notification.id, max_id)
                                    : undefined,
                                since_id
                                    ? gte(notification.id, since_id)
                                    : undefined,
                                min_id
                                    ? gt(notification.id, min_id)
                                    : undefined,
                            ),
                            eq(notification.notifiedId, user.id),
                            eq(notification.accountId, account_id),
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
