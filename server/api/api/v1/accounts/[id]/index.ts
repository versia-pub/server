import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import type { UserWithRelations } from "~database/entities/User";
import { userToAPI } from "~database/entities/User";
import { userRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id",
    auth: {
        required: true,
        oauthPermissions: [],
    },
});

/**
 * Fetch a user
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;
    // Check if ID is valid UUIDv7
    if (
        !id.match(
            /^[0-9A-F]{8}-[0-9A-F]{4}-[7][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
        )
    ) {
        return errorResponse("Invalid ID", 404);
    }

    const { user } = extraData.auth;

    let foundUser: UserWithRelations | null;
    try {
        foundUser = await client.user.findUnique({
            where: { id },
            include: userRelations,
        });
    } catch (e) {
        return errorResponse("Invalid ID", 404);
    }

    if (!foundUser) return errorResponse("User not found", 404);

    return jsonResponse(userToAPI(foundUser, user?.id === foundUser.id));
});
