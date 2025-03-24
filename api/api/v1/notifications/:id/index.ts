import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Notification as NotificationSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Notification } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "get",
    path: "/api/v1/notifications/{id}",
    summary: "Get a single notification",
    description: "View information about a notification with a given ID.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/notifications/#get",
    },
    tags: ["Notifications"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnNotifications],
            scopes: ["read:notifications"],
        }),
    ] as const,
    request: {
        params: z.object({
            id: NotificationSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "A single Notification",
            content: {
                "application/json": {
                    schema: NotificationSchema,
                },
            },
        },
        404: ApiError.notificationNotFound().schema,
        401: ApiError.missingAuthentication().schema,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");

        const { user } = context.get("auth");

        const notification = await Notification.fromId(id, user.id);

        if (!notification || notification.data.notifiedId !== user.id) {
            throw ApiError.notificationNotFound();
        }

        return context.json(await notification.toApi(), 200);
    }),
);
