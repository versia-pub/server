import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { relationshipToAPI } from "~database/entities/Relationship";
import { getRelationshipToOtherUser } from "~database/entities/User";
import { db } from "~drizzle/db";
import { Relationships } from "~drizzle/schema";
import { User } from "~packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/note",
    auth: {
        required: true,
        oauthPermissions: ["write:accounts"],
    },
});

export const schema = z.object({
    comment: z.string().min(0).max(5000).optional(),
});

/**
 * Sets a user note
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const id = matchedRoute.params.id;
        if (!id.match(idValidator)) {
            return errorResponse("Invalid ID, must be of type UUIDv7", 404);
        }

        const { user: self } = extraData.auth;

        if (!self) return errorResponse("Unauthorized", 401);

        const { comment } = extraData.parsedRequest;

        const otherUser = await User.fromId(id);

        if (!otherUser) return errorResponse("User not found", 404);

        // Check if already following
        const foundRelationship = await getRelationshipToOtherUser(
            self,
            otherUser,
        );

        foundRelationship.note = comment ?? "";

        await db
            .update(Relationships)
            .set({
                note: foundRelationship.note,
            })
            .where(eq(Relationships.id, foundRelationship.id));

        return jsonResponse(relationshipToAPI(foundRelationship));
    },
);
