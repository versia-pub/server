import { applyConfig, auth } from "@api";
import { errorResponse, jsonResponse } from "@response";
import type { Hono } from "hono";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/accounts/verify_credentials",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:accounts"],
    },
});

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth),
        async (context) => {
            // TODO: Add checks for disabled/unverified accounts
            const { user } = context.req.valid("header");

            if (!user) return errorResponse("Unauthorized", 401);

            return jsonResponse(user.toAPI(true));
        },
    );
