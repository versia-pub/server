import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Notification } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
import { Notification as NotificationSchema } from "~/classes/schemas/notification.ts";
import { ErrorSchema } from "~/types/api";

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
            permissions: [RolePermissions.ManageOwnNotifications],
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
        404: {
            description: "Notification not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        401: reusedResponses[401],
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");

        const { user } = context.get("auth");

        const notification = await Notification.fromId(id, user.id);

        if (!notification || notification.data.notifiedId !== user.id) {
            throw new ApiError(404, "Notification not found");
        }

        return context.json(await notification.toApi(), 200);
    }),
);
