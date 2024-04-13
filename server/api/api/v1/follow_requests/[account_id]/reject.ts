import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, eq } from "drizzle-orm";
import {
    checkForBidirectionalRelationships,
    relationshipToAPI,
} from "~database/entities/Relationship";
import {
    findFirstUser,
    getRelationshipToOtherUser,
    sendFollowReject,
} from "~database/entities/User";
import { db } from "~drizzle/db";
import { relationship } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    route: "/api/v1/follow_requests/:account_id/reject",
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

    const account = await findFirstUser({
        where: (user, { eq }) => eq(user.id, account_id),
    });

    if (!account) return errorResponse("Account not found", 404);

    // Check if there is a relationship on both sides
    await checkForBidirectionalRelationships(user, account);

    // Reject follow request
    await db
        .update(relationship)
        .set({
            requested: false,
            following: false,
        })
        .where(
            and(
                eq(relationship.subjectId, user.id),
                eq(relationship.ownerId, account.id),
            ),
        );

    // Update followedBy for other user
    await db
        .update(relationship)
        .set({
            followedBy: false,
        })
        .where(
            and(
                eq(relationship.subjectId, account.id),
                eq(relationship.ownerId, user.id),
            ),
        );

    const foundRelationship = await getRelationshipToOtherUser(user, account);

    if (!foundRelationship) return errorResponse("Relationship not found", 404);

    // Check if rejecting remote follow
    if (account.instanceId) {
        // Federate follow reject
        await sendFollowReject(account, user);
    }

    return jsonResponse(relationshipToAPI(foundRelationship));
});
