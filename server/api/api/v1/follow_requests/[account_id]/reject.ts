import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, eq } from "drizzle-orm";
import {
    checkForBidirectionalRelationships,
    relationshipToAPI,
} from "~database/entities/Relationship";
import {
    getRelationshipToOtherUser,
    sendFollowReject,
} from "~database/entities/User";
import { db } from "~drizzle/db";
import { Relationships } from "~drizzle/schema";
import { User } from "~packages/database-interface/user";

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

    const account = await User.fromId(account_id);

    if (!account) return errorResponse("Account not found", 404);

    // Check if there is a relationship on both sides
    await checkForBidirectionalRelationships(user, account);

    // Reject follow request
    await db
        .update(Relationships)
        .set({
            requested: false,
            following: false,
        })
        .where(
            and(
                eq(Relationships.subjectId, user.id),
                eq(Relationships.ownerId, account.id),
            ),
        );

    // Update followedBy for other user
    await db
        .update(Relationships)
        .set({
            followedBy: false,
        })
        .where(
            and(
                eq(Relationships.subjectId, account.id),
                eq(Relationships.ownerId, user.id),
            ),
        );

    const foundRelationship = await getRelationshipToOtherUser(user, account);

    if (!foundRelationship) return errorResponse("Relationship not found", 404);

    // Check if rejecting remote follow
    if (account.isRemote()) {
        // Federate follow reject
        await sendFollowReject(account, user);
    }

    return jsonResponse(relationshipToAPI(foundRelationship));
});
