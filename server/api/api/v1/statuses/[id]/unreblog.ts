import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, eq } from "drizzle-orm";
import { Notes } from "~drizzle/schema";
import { Note } from "~packages/database-interface/note";
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

    const foundStatus = await Note.fromId(id);

    // Check if user is authorized to view this status (if it's private)
    if (!foundStatus?.isViewableByUser(user))
        return errorResponse("Record not found", 404);

    const existingReblog = await Note.fromSql(
        and(
            eq(Notes.authorId, user.id),
            eq(Notes.reblogId, foundStatus.getStatus().id),
        ),
    );

    if (!existingReblog) {
        return errorResponse("Not already reblogged", 422);
    }

    await existingReblog.delete();

    return jsonResponse({
        ...(await foundStatus.toAPI(user)),
        reblogged: false,
        reblogs_count: foundStatus.getStatus().reblogCount - 1,
    } as APIStatus);
});
