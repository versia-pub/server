import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { client } from "~database/datasource";
import { userToAPI, type UserWithRelations } from "~database/entities/User";
import { userRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/follow_requests",
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

    const { objects, link } = await fetchTimeline<UserWithRelations>(
        client.user,
        {
            where: {
                id: {
                    lt: max_id ?? undefined,
                    gte: since_id ?? undefined,
                    gt: min_id ?? undefined,
                },
                relationships: {
                    some: {
                        subjectId: user.id,
                        requested: true,
                    },
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
        objects.map((user) => userToAPI(user)),
        200,
        {
            Link: link,
        },
    );
});
