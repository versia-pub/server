import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import {
    type StatusWithRelations,
    findManyStatuses,
    statusToAPI,
} from "~database/entities/Status";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/favourites",
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
}>(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;

    const { limit = 20, max_id, min_id, since_id } = extraData.parsedRequest;

    if (limit < 1 || limit > 40) {
        return errorResponse("Limit must be between 1 and 40", 400);
    }

    if (!user) return errorResponse("Unauthorized", 401);

    const { objects, link } = await fetchTimeline<StatusWithRelations>(
        findManyStatuses,
        {
            // @ts-ignore
            where: (status, { and, lt, gt, gte, eq, sql }) =>
                and(
                    max_id ? lt(status.id, max_id) : undefined,
                    since_id ? gte(status.id, since_id) : undefined,
                    min_id ? gt(status.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Like" WHERE "Like"."likedId" = ${status.id} AND "Like"."likerId" = ${user.id})`,
                ),
            // @ts-expect-error Yes I KNOW the types are wrong
            orderBy: (status, { desc }) => desc(status.id),
        },
        req,
    );

    return jsonResponse(
        await Promise.all(
            objects.map(async (status) => statusToAPI(status, user)),
        ),
        200,
        {
            Link: link,
        },
    );
});
