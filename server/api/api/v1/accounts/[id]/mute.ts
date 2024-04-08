import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import {
    createNewRelationship,
    relationshipToAPI,
} from "~database/entities/Relationship";
import { getRelationshipToOtherUser } from "~database/entities/User";

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

    const user = await client.user.findUnique({
        where: { id },
        include: {
            relationships: {
                include: {
                    owner: true,
                    subject: true,
                },
            },
        },
    });

    if (!user) return errorResponse("User not found", 404);

    // Check if already following
    let relationship = await getRelationshipToOtherUser(self, user);

    if (!relationship) {
        // Create new relationship

        const newRelationship = await createNewRelationship(self, user);

        await client.user.update({
            where: { id: self.id },
            data: {
                relationships: {
                    connect: {
                        id: newRelationship.id,
                    },
                },
            },
        });

        relationship = newRelationship;
    }

    if (!relationship.muting) {
        relationship.muting = true;
    }
    if (notifications ?? true) {
        relationship.mutingNotifications = true;
    }

    await client.relationship.update({
        where: { id: relationship.id },
        data: {
            muting: true,
            mutingNotifications: notifications ?? true,
        },
    });

    // TODO: Implement duration

    return jsonResponse(relationshipToAPI(relationship));
});
