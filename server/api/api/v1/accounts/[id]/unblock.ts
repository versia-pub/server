import { apiRoute, applyConfig, idValidator } from "@api";
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
    route: "/api/v1/accounts/:id/unblock",
    auth: {
        required: true,
        oauthPermissions: ["write:blocks"],
    },
});

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

    const foundRelationship = await getRelationshipToOtherUser(self, otherUser);

    if (foundRelationship.blocking) {
        foundRelationship.blocking = false;

        await db
            .update(relationship)
            .set({
                blocking: false,
            })
            .where(eq(relationship.id, foundRelationship.id));
    }

    return jsonResponse(relationshipToAPI(foundRelationship));
});
