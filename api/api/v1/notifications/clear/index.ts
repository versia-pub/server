import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { db } from "~/drizzle/db";
import { Notifications, RolePermissions } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
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

const route = createRoute({
    method: "post",
    path: "/api/v1/notifications/clear",
    summary: "Clear notifications",
    middleware: [auth(meta.auth, meta.permissions)],
    responses: {
        200: {
            description: "Notifications cleared",
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        await db
            .update(Notifications)
            .set({
                dismissed: true,
            })
            .where(eq(Notifications.notifiedId, user.id));

        return context.newResponse(null, 200);
    }),
);
