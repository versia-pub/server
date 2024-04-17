import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, eq } from "drizzle-orm";
import { relationshipToAPI } from "~database/entities/Relationship";
import {
    findFirstUser,
    getRelationshipToOtherUser,
} from "~database/entities/User";
import { db } from "~drizzle/db";
import { Relationships } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/remove_from_followers",
    auth: {
        required: true,
        oauthPermissions: ["write:follows"],
    },
});

/**
 * Removes an account from your followers list
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;
    if (!id.match(idValidator)) {
        return errorResponse("Invalid ID, must be of type UUIDv7", 404);
    }

    const { user: self } = extraData.auth;

    if (!self) return errorResponse("Unauthorized", 401);

    const otherUser = await findFirstUser({
        where: (user, { eq }) => eq(user.id, id),
    });

    if (!otherUser) return errorResponse("User not found", 404);

    // Check if already following
    const foundRelationship = await getRelationshipToOtherUser(self, otherUser);

    if (foundRelationship.followedBy) {
        foundRelationship.followedBy = false;

        await db
            .update(Relationships)
            .set({
                followedBy: false,
            })
            .where(eq(Relationships.id, foundRelationship.id));

        if (otherUser.instanceId === null) {
            // Also remove from followers list
            await db
                .update(Relationships)
                .set({
                    following: false,
                })
                .where(
                    and(
                        eq(Relationships.ownerId, otherUser.id),
                        eq(Relationships.subjectId, self.id),
                    ),
                );
        }
    }

    return jsonResponse(relationshipToAPI(foundRelationship));
});
