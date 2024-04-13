import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { findFirstStatuses, isViewableByUser } from "~database/entities/Status";
import {
    type UserWithRelations,
    findManyUsers,
    userToAPI,
} from "~database/entities/User";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/reblogged_by",
    auth: {
        required: true,
    },
});

/**
 * Fetch users who reblogged the post
 */
export default apiRoute<{
    max_id?: string;
    min_id?: string;
    since_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    const { user } = extraData.auth;

    const status = await findFirstStatuses({
        where: (status, { eq }) => eq(status.id, id),
    });

    // Check if user is authorized to view this status (if it's private)
    if (!status || !isViewableByUser(status, user))
        return errorResponse("Record not found", 404);

    const {
        max_id = null,
        min_id = null,
        since_id = null,
        limit = 40,
    } = extraData.parsedRequest;

    // Check for limit limits
    if (limit > 80) return errorResponse("Invalid limit (maximum is 80)", 400);
    if (limit < 1) return errorResponse("Invalid limit", 400);

    const { objects, link } = await fetchTimeline<UserWithRelations>(
        findManyUsers,
        {
            // @ts-ignore
            where: (reblogger, { and, lt, gt, gte, eq, sql }) =>
                and(
                    max_id ? lt(reblogger.id, max_id) : undefined,
                    since_id ? gte(reblogger.id, since_id) : undefined,
                    min_id ? gt(reblogger.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Status" WHERE "Status"."reblogId" = ${status.id} AND "Status"."authorId" = ${reblogger.id})`,
                ),
            // @ts-expect-error Yes I KNOW the types are wrong
            orderBy: (liker, { desc }) => desc(liker.id),
        },
        req,
    );

    return jsonResponse(
        objects.map((user) => userToAPI(user)),
        200,
        {
            Link: link,
        },
    );
});
