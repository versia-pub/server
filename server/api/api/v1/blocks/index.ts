import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { client } from "~database/datasource";
import { userToAPI, type UserWithRelations } from "~database/entities/User";
import { userRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/blocks",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:blocks"],
    },
});

export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const { max_id, since_id, limit = 40 } = extraData.parsedRequest;

    const { objects: blocks, link } = await fetchTimeline<UserWithRelations>(
        client.user,
        {
            where: {
                relationshipSubjects: {
                    some: {
                        ownerId: user.id,
                        blocking: true,
                    },
                },
                id: {
                    lt: max_id,
                    gte: since_id,
                },
            },
            include: userRelations,
            take: Number(limit),
        },
        req,
    );

    return jsonResponse(
        blocks.map((u) => userToAPI(u)),
        200,
        {
            Link: link,
        },
    );
});
