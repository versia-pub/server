import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
import { z } from "zod";
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
    route: "/api/v1/accounts/:id/mute",
    auth: {
        required: true,
        oauthPermissions: ["write:mutes"],
    },
});

export const schema = z.object({
    notifications: z.coerce.boolean().optional(),
    duration: z
        .number()
        .int()
        .min(60)
        .max(60 * 60 * 24 * 365 * 5)
        .optional(),
});

/**
 * Mute a user
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const id = matchedRoute.params.id;
        if (!id.match(idValidator)) {
            return errorResponse("Invalid ID, must be of type UUIDv7", 404);
        }

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
            .update(Relationships)
            .set({
                muting: true,
                mutingNotifications: notifications ?? true,
            })
            .where(eq(Relationships.id, foundRelationship.id));

        // TODO: Implement duration

        return jsonResponse(relationshipToAPI(foundRelationship));
    },
);
