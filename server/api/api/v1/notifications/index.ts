import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { client } from "~database/datasource";
import {
    findManyNotifications,
    notificationToAPI,
} from "~database/entities/Notification";
import {
    statusAndUserRelations,
    userRelations,
} from "~database/entities/relations";
import type {
    Notification,
    NotificationWithRelations,
} from "~database/entities/Notification";
import { db } from "~drizzle/db";

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

export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: number;
    exclude_types?: string[];
    types?: string[];
    account_id?: string;
}>(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const {
        account_id,
        exclude_types,
        limit = 15,
        max_id,
        min_id,
        since_id,
        types,
    } = extraData.parsedRequest;

    if (limit > 80) return errorResponse("Limit too high", 400);

    if (limit <= 0) return errorResponse("Limit too low", 400);

    if (types && exclude_types) {
        return errorResponse("Can't use both types and exclude_types", 400);
    }

    const { objects, link } = await fetchTimeline<NotificationWithRelations>(
        findManyNotifications,
        {
            // @ts-expect-error Yes I KNOW the types are wrong
            where: (notification, { lt, gte, gt, and, or, eq, inArray, sql }) =>
                or(
                    and(
                        max_id ? lt(notification.id, max_id) : undefined,
                        since_id ? gte(notification.id, since_id) : undefined,
                        min_id ? gt(notification.id, min_id) : undefined,
                    ),
                    eq(notification.notifiedId, user.id),
                    eq(notification.accountId, account_id),
                ),
            with: {},
            limit: Number(limit),
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
});
