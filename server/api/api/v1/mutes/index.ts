import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { userToAPI } from "~database/entities/User";
import { userRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/mutes",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
    },
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const blocks = await client.user.findMany({
        where: {
            relationshipSubjects: {
                some: {
                    ownerId: user.id,
                    muting: true,
                },
            },
        },
        include: userRelations,
    });

    return jsonResponse(blocks.map((u) => userToAPI(u)));
});
