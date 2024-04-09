import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { client } from "~database/datasource";
import { type UserWithRelations, userToAPI } from "~database/entities/User";
import { userRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 60,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/followers",
    auth: {
        required: false,
        oauthPermissions: [],
    },
});

/**
 * Fetch all statuses for a user
 */
export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    // TODO: Add pinned
    const { max_id, min_id, since_id, limit = 20 } = extraData.parsedRequest;

    const user = await client.user.findUnique({
        where: { id },
        include: userRelations,
    });

    if (limit < 1 || limit > 40) return errorResponse("Invalid limit", 400);

    if (!user) return errorResponse("User not found", 404);

    const { objects, link } = await fetchTimeline<UserWithRelations>(
        client.user,
        {
            where: {
                relationships: {
                    some: {
                        subjectId: user.id,
                        following: true,
                    },
                },
                id: {
                    lt: max_id,
                    gt: min_id,
                    gte: since_id,
                },
            },
            include: userRelations,
            take: Number(limit),
            orderBy: {
                id: "desc",
            },
        },
        req,
    );

    return jsonResponse(
        await Promise.all(objects.map((object) => userToAPI(object))),
        200,
        {
            Link: link,
        },
    );
});
