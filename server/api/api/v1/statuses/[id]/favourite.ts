import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { createLike } from "~database/entities/Like";
import { db } from "~drizzle/db";
import { Note } from "~packages/database-interface/note";
import type { Status as APIStatus } from "~types/mastodon/status";

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
    if (!id.match(idValidator)) {
        return errorResponse("Invalid ID, must be of type UUIDv7", 404);
    }

    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const status = await Note.fromId(id);

    // Check if user is authorized to view this status (if it's private)
    if (!status?.isViewableByUser(user))
        return errorResponse("Record not found", 404);

    const existingLike = await db.query.Likes.findFirst({
        where: (like, { and, eq }) =>
            and(
                eq(like.likedId, status.getStatus().id),
                eq(like.likerId, user.id),
            ),
    });

    if (!existingLike) {
        await createLike(user, status.getStatus());
    }

    return jsonResponse({
        ...(await status.toAPI(user)),
        favourited: true,
        favourites_count: status.getStatus().likeCount + 1,
    } as APIStatus);
});
