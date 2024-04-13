import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { findFirstStatuses, statusToAPI } from "~database/entities/Status";
import { db } from "~drizzle/db";
import { statusToUser } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/pin",
    auth: {
        required: true,
    },
});

/**
 * Pin a post
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const foundStatus = await findFirstStatuses({
        where: (status, { eq }) => eq(status.id, id),
    });

    // Check if status exists
    if (!foundStatus) return errorResponse("Record not found", 404);

    // Check if status is user's
    if (foundStatus.authorId !== user.id)
        return errorResponse("Unauthorized", 401);

    // Check if post is already pinned
    if (
        await db.query.statusToUser.findFirst({
            where: (statusToUser, { and, eq }) =>
                and(
                    eq(statusToUser.a, foundStatus.id),
                    eq(statusToUser.b, user.id),
                ),
        })
    ) {
        return errorResponse("Already pinned", 422);
    }

    await db.insert(statusToUser).values({
        a: foundStatus.id,
        b: user.id,
    });

    return jsonResponse(statusToAPI(foundStatus, user));
});
