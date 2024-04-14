import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { getFromToken } from "~database/entities/Application";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/apps/verify_credentials",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
    },
});

/**
 * Returns OAuth2 credentials
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const { user, token } = extraData.auth;

    if (!token) return errorResponse("Unauthorized", 401);
    if (!user) return errorResponse("Unauthorized", 401);

    const application = await getFromToken(token);

    if (!application) return errorResponse("Unauthorized", 401);

    return jsonResponse({
        name: application.name,
        website: application.website,
        vapid_key: application.vapidKey,
        redirect_uris: application.redirectUris,
        scopes: application.scopes,
    });
});
