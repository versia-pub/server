import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
import {
    findFirstStatuses,
    isViewableByUser,
    statusToAPI,
} from "~database/entities/Status";
import { db } from "~drizzle/db";
import { status } from "~drizzle/schema";
import type { Status as APIStatus } from "~types/mastodon/status";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/unreblog",
    auth: {
        required: true,
    },
});

/**
 * Unreblogs a post
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

    const existingReblog = await findFirstStatuses({
        where: (status, { eq }) =>
            eq(status.authorId, user.id) && eq(status.reblogId, foundStatus.id),
    });

    if (!existingReblog) {
        return errorResponse("Not already reblogged", 422);
    }

    await db.delete(status).where(eq(status.id, existingReblog.id));

    return jsonResponse({
        ...(await statusToAPI(foundStatus, user)),
        reblogged: false,
        reblogs_count: foundStatus.reblogCount - 1,
    } as APIStatus);
});
