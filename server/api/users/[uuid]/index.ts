import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { findFirstUser, userToLysand } from "~database/entities/User";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/users/:uuid",
});

export default apiRoute(async (req, matchedRoute) => {
    const uuid = matchedRoute.params.uuid;

    const user = await findFirstUser({
        where: (user, { eq }) => eq(user.id, uuid),
    });

    if (!user) {
        return errorResponse("User not found", 404);
    }

    return jsonResponse(userToLysand(user));
});
