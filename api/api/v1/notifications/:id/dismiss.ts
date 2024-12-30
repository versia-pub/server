import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Notification } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/notifications/{id}/dismiss",
    summary: "Dismiss notification",
    middleware: [
        auth({
            auth: true,
            scopes: ["write:notifications"],
            permissions: [RolePermissions.ManageOwnNotifications],
        }),
    ] as const,
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
    },
    responses: {
        200: {
            description: "Notification dismissed",
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");

        const { user } = context.get("auth");

        const notification = await Notification.fromId(id);

        if (!notification || notification.data.notifiedId !== user.id) {
            throw new ApiError(404, "Notification not found");
        }

        await notification.update({
            dismissed: true,
        });

        return context.text("", 200);
    }),
);
