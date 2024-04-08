import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { client } from "~database/datasource";
import { isViewableByUser } from "~database/entities/Status";
import { userToAPI, type UserWithRelations } from "~database/entities/User";
import {
    statusAndUserRelations,
    userRelations,
} from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/favourited_by",
    auth: {
        required: true,
    },
});

/**
 * Fetch users who favourited the post
 */
export default apiRoute<{
    max_id?: string;
    min_id?: string;
    since_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    const { user } = extraData.auth;

    const status = await client.status.findUnique({
        where: { id },
        include: statusAndUserRelations,
    });

    // Check if user is authorized to view this status (if it's private)
    if (!status || !isViewableByUser(status, user))
        return errorResponse("Record not found", 404);

    const { max_id, min_id, since_id, limit = 40 } = extraData.parsedRequest;

    // Check for limit limits
    if (limit > 80) return errorResponse("Invalid limit (maximum is 80)", 400);
    if (limit < 1) return errorResponse("Invalid limit", 400);

    const { objects, link } = await fetchTimeline<UserWithRelations>(
        client.user,
        {
            where: {
                likes: {
                    some: {
                        likedId: status.id,
                    },
                },
                id: {
                    lt: max_id,
                    gte: since_id,
                    gt: min_id,
                },
            },
            include: {
                ...userRelations,
                likes: {
                    where: {
                        likedId: status.id,
                    },
                },
            },
            take: Number(limit),
            orderBy: {
                id: "desc",
            },
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
