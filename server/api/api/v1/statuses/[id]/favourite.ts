import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { createLike } from "~database/entities/Like";
import {
    findFirstStatuses,
    isViewableByUser,
    statusToAPI,
} from "~database/entities/Status";
import { db } from "~drizzle/db";
import type { APIStatus } from "~types/entities/status";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/favourite",
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

    const existingLike = await db.query.like.findFirst({
        where: (like, { and, eq }) =>
            and(eq(like.likedId, status.id), eq(like.likerId, user.id)),
    });

    if (!existingLike) {
        await createLike(user, status);
    }

    return jsonResponse({
        ...(await statusToAPI(status, user)),
        favourited: true,
        favourites_count: status.likeCount + 1,
    } as APIStatus);
});
