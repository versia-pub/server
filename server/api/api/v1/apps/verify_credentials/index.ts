import { applyConfig, auth } from "@api";
import { errorResponse, jsonResponse } from "@response";
import type { Hono } from "hono";
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

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth),
        async (context) => {
            const { user, token } = context.req.valid("header");

            if (!token) return errorResponse("Unauthorized", 401);
            if (!user) return errorResponse("Unauthorized", 401);

            const application = await getFromToken(token);

            if (!application) return errorResponse("Unauthorized", 401);

            return jsonResponse({
                name: application.name,
                website: application.website,
                vapid_key: application.vapidKey,
                redirect_uris: application.redirectUri,
                scopes: application.scopes,
            });
        },
    );
