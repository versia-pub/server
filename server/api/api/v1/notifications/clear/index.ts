import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
import { db } from "~drizzle/db";
import { Notifications } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    route: "/api/v1/notifications/clear",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["write:notifications"],
    },
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;
    if (!user) return errorResponse("Unauthorized", 401);

    await db
        .update(Notifications)
        .set({
            dismissed: true,
        })
        .where(eq(Notifications.notifiedId, user.id));

    return jsonResponse({});
});