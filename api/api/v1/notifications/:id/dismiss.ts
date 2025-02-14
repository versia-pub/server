import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Notification } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
import { Notification as NotificationSchema } from "~/classes/schemas/notification";

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
            permissions: [RolePermissions.ManageOwnNotifications],
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
        401: reusedResponses[401],
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
