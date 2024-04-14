import { apiRoute, applyConfig } from "@api";
import { errorResponse } from "@response";
import { findFirstStatuses, isViewableByUser } from "~database/entities/Status";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/source",
    auth: {
        required: true,
    },
});

/**
 * Favourite a post
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const status = await findFirstStatuses({
        where: (status, { eq }) => eq(status.id, id),
    });

    // Check if user is authorized to view this status (if it's private)
    if (!status || !isViewableByUser(status, user))
        return errorResponse("Record not found", 404);

    return errorResponse("Not implemented yet");
});
