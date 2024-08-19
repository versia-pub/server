import { apiRoute, applyConfig, auth } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { getFromToken } from "~/classes/functions/application";
import { RolePermissions } from "~/drizzle/schema";

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
    permissions: {
        required: [RolePermissions.ManageOwnApps],
    },
});

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user, token } = context.req.valid("header");

            if (!token) {
                return errorResponse("Unauthorized", 401);
            }
            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const application = await getFromToken(token);

            if (!application) {
                return errorResponse("Unauthorized", 401);
            }

            return jsonResponse({
                name: application.name,
                website: application.website,
                vapid_key: application.vapidKey,
                redirect_uris: application.redirectUri,
                scopes: application.scopes,
            });
        },
    ),
);
