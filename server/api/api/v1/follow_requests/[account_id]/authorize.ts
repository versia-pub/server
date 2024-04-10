import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import {
    checkForBidirectionalRelationships,
    relationshipToAPI,
} from "~database/entities/Relationship";
import { sendFollowAccept } from "~database/entities/User";
import { userRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    route: "/api/v1/follow_requests/:account_id/authorize",
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

    const { account_id } = matchedRoute.params;

    const account = await client.user.findUnique({
        where: {
            id: account_id,
        },
        include: userRelations,
    });

    if (!account) return errorResponse("Account not found", 404);

    // Check if there is a relationship on both sides
    await checkForBidirectionalRelationships(user, account);

    // Authorize follow request
    await client.relationship.updateMany({
        where: {
            subjectId: user.id,
            ownerId: account.id,
            requested: true,
        },
        data: {
            requested: false,
            following: true,
        },
    });

    // Update followedBy for other user
    await client.relationship.updateMany({
        where: {
            subjectId: account.id,
            ownerId: user.id,
        },
        data: {
            followedBy: true,
        },
    });

    const relationship = await client.relationship.findFirst({
        where: {
            subjectId: account.id,
            ownerId: user.id,
        },
    });

    if (!relationship) return errorResponse("Relationship not found", 404);

    // Check if accepting remote follow
    if (account.instanceId) {
        // Federate follow accept
        await sendFollowAccept(account, user);
    }

    return jsonResponse(relationshipToAPI(relationship));
});
