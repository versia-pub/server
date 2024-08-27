import { apiRoute, applyConfig, auth } from "@/api";
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

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user } = context.req.valid("header");
            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            await db
                .update(Notifications)
                .set({
                    dismissed: true,
                })
                .where(eq(Notifications.notifiedId, user.id));

            return context.json({});
        },
    ),
);
