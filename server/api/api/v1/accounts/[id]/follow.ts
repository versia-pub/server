import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import {
    createNewRelationship,
    relationshipToAPI,
} from "~database/entities/Relationship";
import {
    followRequestUser,
    followUser,
    getRelationshipToOtherUser,
} from "~database/entities/User";

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

    if (!relationship.following) {
        if (user.isLocked) {
            relationship = await followRequestUser(
                self,
                user,
                reblogs,
                notify,
                languages,
            );
        } else {
            relationship = await followUser(
                self,
                user,
                reblogs,
                notify,
                languages,
            );
        }
    }

    return jsonResponse(relationshipToAPI(relationship));
});
