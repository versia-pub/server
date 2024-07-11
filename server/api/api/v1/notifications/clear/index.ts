import { applyConfig, auth } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { eq } from "drizzle-orm";
import { db } from "~/drizzle/db";
import { Notifications, RolePermissions } from "~/drizzle/schema";

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
    permissions: {
        required: [RolePermissions.ManageOwnNotifications],
    },
});

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user } = context.req.valid("header");
            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            await db
                .update(Notifications)
                .set({
                    dismissed: true,
                })
                .where(eq(Notifications.notifiedId, user.id));

            return jsonResponse({});
        },
    );
