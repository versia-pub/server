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
    route: "/api/v1/accounts/:id/follow",
    auth: {
        required: true,
        oauthPermissions: ["write:follows"],
    },
});

/**
 * Follow a user
 */
export default apiRoute<{
    reblogs?: boolean;
    notify?: boolean;
    languages?: string[];
}>(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    const { user: self } = extraData.auth;

    if (!self) return errorResponse("Unauthorized", 401);

    const { languages, notify, reblogs } = extraData.parsedRequest;

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

    if (!relationship.following) {
        relationship.following = true;
    }
    if (reblogs) {
        relationship.showingReblogs = true;
    }
    if (notify) {
        relationship.notifying = true;
    }
    if (languages) {
        relationship.languages = languages;
    }

    await client.relationship.update({
        where: { id: relationship.id },
        data: {
            following: true,
            showingReblogs: reblogs ?? false,
            notifying: notify ?? false,
            languages: languages ?? [],
        },
    });

    return jsonResponse(relationshipToAPI(relationship));
});
