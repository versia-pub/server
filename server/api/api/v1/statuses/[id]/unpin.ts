import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { Note } from "~packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/unpin",
    auth: {
        required: true,
    },
});

/**
 * Unpins a post
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;
    if (!id.match(idValidator)) {
        return errorResponse("Invalid ID, must be of type UUIDv7", 404);
    }

    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const status = await Note.fromId(id);

    // Check if status exists
    if (!status) return errorResponse("Record not found", 404);

    // Check if status is user's
    if (status.getAuthor().id !== user.id)
        return errorResponse("Unauthorized", 401);

    await status.unpin(user);

    if (!status) return errorResponse("Record not found", 404);

    return jsonResponse(await status.toAPI(user));
});
