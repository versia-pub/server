import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { client } from "~database/datasource";
import {
    type StatusWithRelations,
    statusToAPI,
} from "~database/entities/Status";
import { statusAndUserRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 200,
        duration: 60,
    },
    route: "/api/v1/timelines/home",
    auth: {
        required: true,
    },
});

/**
 * Fetch home timeline statuses
 */
export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;

    const { limit = 20, max_id, min_id, since_id } = extraData.parsedRequest;

    if (limit < 1 || limit > 80) {
        return errorResponse("Limit must be between 1 and 40", 400);
    }

    if (!user) return errorResponse("Unauthorized", 401);

    const { objects, link } = await fetchTimeline<StatusWithRelations>(
        client.status,
        {
            where: {
                id: {
                    lt: max_id ?? undefined,
                    gte: since_id ?? undefined,
                    gt: min_id ?? undefined,
                },
                OR: [
                    {
                        author: {
                            OR: [
                                {
                                    relationshipSubjects: {
                                        some: {
                                            ownerId: user.id,
                                            following: true,
                                        },
                                    },
                                },
                                {
                                    id: user.id,
                                },
                            ],
                        },
                    },
                    {
                        // Include posts where the user is mentioned in addition to posts by followed users
                        mentions: {
                            some: {
                                id: user.id,
                            },
                        },
                    },
                ],
            },
            include: statusAndUserRelations,
            take: Number(limit),
            orderBy: {
                id: "desc",
            },
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
