import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { userToLysand } from "~database/entities/User";
import { userRelations } from "~database/entities/relations";

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

    const user = await client.user.findUnique({
        where: {
            id: uuid,
        },
        include: userRelations,
    });

    if (!user) {
        return errorResponse("User not found", 404);
    }

    return jsonResponse(userToLysand(user));
});
