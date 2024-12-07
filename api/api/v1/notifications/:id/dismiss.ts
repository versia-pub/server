import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Notification } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    route: "/api/v1/notifications/:id/dismiss",
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

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/notifications/{id}/dismiss",
    summary: "Dismiss notification",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Notification dismissed",
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
        const { id } = context.req.valid("param");

        const { user } = context.get("auth");
        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const notification = await Notification.fromId(id);

        if (!notification) {
            return context.json({ error: "Notification not found" }, 404);
        }

        await notification.update({
            dismissed: true,
        });

        return context.text("", 200);
    }),
);
