import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { findManyNotifications } from "~database/entities/Notification";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/notifications/:id",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:notifications"],
    },
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;
    if (!id.match(idValidator)) {
        return errorResponse("Invalid ID, must be of type UUIDv7", 404);
    }

    const { user } = extraData.auth;
    if (!user) return errorResponse("Unauthorized", 401);

    const notification = (
        await findManyNotifications({
            where: (notification, { eq }) => eq(notification.id, id),
            limit: 1,
        })
    )[0];

    if (!notification) return errorResponse("Notification not found", 404);

    return jsonResponse(notification);
});
