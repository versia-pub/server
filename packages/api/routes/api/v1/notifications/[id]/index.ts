import {
    Notification as NotificationSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Notification } from "@versia-server/kit/db";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.get(
        "/api/v1/notifications/:id",
        describeRoute({
            summary: "Get a single notification",
            description:
                "View information about a notification with a given ID.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/notifications/#get",
            },
            tags: ["Notifications"],
            responses: {
                200: {
                    description: "A single Notification",
                    content: {
                        "application/json": {
                            schema: resolver(NotificationSchema),
                        },
                    },
                },
                404: ApiError.notificationNotFound().schema,
                401: ApiError.missingAuthentication().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnNotifications],
            scopes: ["read:notifications"],
        }),
        validator(
            "param",
            z.object({
                id: NotificationSchema.shape.id,
            }),
            handleZodError,
        ),
        async (context) => {
            const { id } = context.req.valid("param");

            const { user } = context.get("auth");

            const notification = await Notification.fromId(id, user.id);

            if (!notification || notification.data.notifiedId !== user.id) {
                throw ApiError.notificationNotFound();
            }

            return context.json(await notification.toApi(), 200);
        },
    ),
);
