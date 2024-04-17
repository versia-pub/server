import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
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
    route: "/api/v1/accounts/:id/unpin",
    auth: {
        required: true,
        oauthPermissions: ["write:accounts"],
    },
});

/**
 * Unpin a user
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

    if (foundRelationship.endorsed) {
        foundRelationship.endorsed = false;

        await db
            .update(Relationships)
            .set({
                endorsed: false,
            })
            .where(eq(Relationships.id, foundRelationship.id));
    }

    return jsonResponse(relationshipToAPI(foundRelationship));
});
