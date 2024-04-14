import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { deleteLike } from "~database/entities/Like";
import {
    findFirstStatuses,
    isViewableByUser,
    statusToAPI,
} from "~database/entities/Status";
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
    if (!id.match(idValidator)) {
        return errorResponse("Invalid ID, must be of type UUIDv7", 404);
    }

    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const foundStatus = await findFirstStatuses({
        where: (status, { eq }) => eq(status.id, id),
    });

    // Check if user is authorized to view this status (if it's private)
    if (!foundStatus || !isViewableByUser(foundStatus, user))
        return errorResponse("Record not found", 404);

    await deleteLike(user, foundStatus);

    return jsonResponse({
        ...(await statusToAPI(foundStatus, user)),
        favourited: false,
        favourites_count: foundStatus.likeCount - 1,
    } as APIStatus);
});
