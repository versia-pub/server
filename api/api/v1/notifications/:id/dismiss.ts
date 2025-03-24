import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Notification as NotificationSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Notification } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/notifications/{id}/dismiss",
    summary: "Dismiss a single notification",
    description: "Dismiss a single notification from the server.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/notifications/#dismiss",
    },
    tags: ["Notifications"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:notifications"],
            permissions: [RolePermission.ManageOwnNotifications],
        }),
    ] as const,
    request: {
        params: z.object({
            id: NotificationSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "Notification with given ID successfully dismissed",
        },
        401: ApiError.missingAuthentication().schema,
        404: ApiError.notificationNotFound().schema,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");

        const { user } = context.get("auth");

        const notification = await Notification.fromId(id);

        if (!notification || notification.data.notifiedId !== user.id) {
            throw ApiError.notificationNotFound();
        }

        await notification.update({
            dismissed: true,
        });

        return context.text("", 200);
    }),
);
