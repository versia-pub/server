import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { deleteLike } from "~database/entities/Like";
import { isViewableByUser, statusToAPI } from "~database/entities/Status";
import { statusAndUserRelations } from "~database/entities/relations";
import type { APIStatus } from "~types/entities/status";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/unfavourite",
    auth: {
        required: true,
    },
});

/**
 * Unfavourite a post
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const status = await client.status.findUnique({
        where: { id },
        include: statusAndUserRelations,
    });

    // Check if user is authorized to view this status (if it's private)
    if (!status || !isViewableByUser(status, user))
        return errorResponse("Record not found", 404);

    await deleteLike(user, status);

    return jsonResponse({
        ...(await statusToAPI(status, user)),
        favourited: false,
        favourites_count: status._count.likes - 1,
    } as APIStatus);
});
