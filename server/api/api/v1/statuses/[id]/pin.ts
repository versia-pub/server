import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { db } from "~drizzle/db";
import { NoteToMentions, UserToPinnedNotes } from "~drizzle/schema";
import { Note } from "~packages/database-interface/note";

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
    if (!id.match(idValidator)) {
        return errorResponse("Invalid ID, must be of type UUIDv7", 404);
    }

    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const foundStatus = await Note.fromId(id);

    // Check if status exists
    if (!foundStatus) return errorResponse("Record not found", 404);

    // Check if status is user's
    if (foundStatus.getAuthor().id !== user.id)
        return errorResponse("Unauthorized", 401);

    // Check if post is already pinned
    if (
        await db.query.UserToPinnedNotes.findFirst({
            where: (userPinnedNote, { and, eq }) =>
                and(
                    eq(userPinnedNote.noteId, foundStatus.getStatus().id),
                    eq(userPinnedNote.userId, user.id),
                ),
        })
    ) {
        return errorResponse("Already pinned", 422);
    }

    await user.pin(foundStatus);

    return jsonResponse(await foundStatus.toAPI(user));
});
