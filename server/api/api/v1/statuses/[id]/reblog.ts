import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import {
    findFirstStatuses,
    isViewableByUser,
    statusToAPI,
} from "~database/entities/Status";
import { statusAndUserRelations } from "~database/entities/relations";
import { db } from "~drizzle/db";
import { notification, status } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/reblog",
    auth: {
        required: true,
    },
});

/**
 * Reblogs a post
 */
export default apiRoute<{
    visibility: "public" | "unlisted" | "private";
}>(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const { visibility = "public" } = extraData.parsedRequest;

    const foundStatus = await findFirstStatuses({
        where: (status, { eq }) => eq(status.id, id),
    });

    // Check if user is authorized to view this status (if it's private)
    if (!foundStatus || !isViewableByUser(foundStatus, user))
        return errorResponse("Record not found", 404);

    const existingReblog = await db.query.status.findFirst({
        where: (status, { and, eq }) =>
            and(eq(status.authorId, user.id), eq(status.reblogId, status.id)),
    });

    if (existingReblog) {
        return errorResponse("Already reblogged", 422);
    }

    const newReblog = (
        await db
            .insert(status)
            .values({
                authorId: user.id,
                reblogId: foundStatus.id,
                visibility,
                sensitive: false,
                updatedAt: new Date().toISOString(),
            })
            .returning()
    )[0];

    if (!newReblog) {
        return errorResponse("Failed to reblog", 500);
    }

    const finalNewReblog = await findFirstStatuses({
        where: (status, { eq }) => eq(status.id, newReblog.id),
    });

    if (!finalNewReblog) {
        return errorResponse("Failed to reblog", 500);
    }

    // Create notification for reblog if reblogged user is on the same instance
    if (foundStatus.author.instanceId === user.instanceId) {
        await db.insert(notification).values({
            accountId: user.id,
            notifiedId: foundStatus.authorId,
            type: "reblog",
            statusId: foundStatus.reblogId,
        });
    }

    return jsonResponse(await statusToAPI(finalNewReblog, user));
});
