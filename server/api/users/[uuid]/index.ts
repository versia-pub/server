import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { User } from "~packages/database-interface/user";

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

    const user = await User.fromId(uuid);

    if (!user) {
        return errorResponse("User not found", 404);
    }

    return jsonResponse(user.toLysand());
});
