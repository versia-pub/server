import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
import { relationshipToAPI } from "~database/entities/Relationship";
import {
    findFirstUser,
    getRelationshipToOtherUser,
} from "~database/entities/User";
import { db } from "~drizzle/db";
import { relationship } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/mute",
    auth: {
        required: true,
        oauthPermissions: ["write:mutes"],
    },
});

/**
 * Mute a user
 */
export default apiRoute<{
    notifications: boolean;
    duration: number;
}>(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    const { user: self } = extraData.auth;

    if (!self) return errorResponse("Unauthorized", 401);

    const { notifications, duration } = extraData.parsedRequest;

    const user = await findFirstUser({
        where: (user, { eq }) => eq(user.id, id),
    });

    if (!user) return errorResponse("User not found", 404);

    // Check if already following
    const foundRelationship = await getRelationshipToOtherUser(self, user);

    if (!foundRelationship.muting) {
        foundRelationship.muting = true;
    }
    if (notifications ?? true) {
        foundRelationship.mutingNotifications = true;
    }

    await db
        .update(relationship)
        .set({
            muting: true,
            mutingNotifications: notifications ?? true,
        })
        .where(eq(relationship.id, foundRelationship.id));

    // TODO: Implement duration

    return jsonResponse(relationshipToAPI(foundRelationship));
});
