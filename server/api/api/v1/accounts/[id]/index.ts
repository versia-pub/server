import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { findFirstUser, userToAPI } from "~database/entities/User";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id",
    auth: {
        required: false,
        oauthPermissions: [],
    },
});

/**
 * Fetch a user
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;
    if (!id.match(idValidator)) {
        return errorResponse("Invalid ID, must be of type UUIDv7", 404);
    }

    const { user } = extraData.auth;

    const foundUser = await findFirstUser({
        where: (user, { eq }) => eq(user.id, id),
    }).catch(() => null);

    if (!foundUser) return errorResponse("User not found", 404);

    return jsonResponse(userToAPI(foundUser, user?.id === foundUser.id));
});
