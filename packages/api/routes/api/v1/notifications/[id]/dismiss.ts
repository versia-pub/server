import {
    Notification as NotificationSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Notification } from "@versia-server/kit/db";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.post(
        "/api/v1/notifications/:id/dismiss",
        describeRoute({
            summary: "Dismiss a single notification",
            description: "Dismiss a single notification from the server.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/notifications/#dismiss",
            },
            tags: ["Notifications"],
            responses: {
                200: {
                    description:
                        "Notification with given ID successfully dismissed",
                },
                401: ApiError.missingAuthentication().schema,
                404: ApiError.notificationNotFound().schema,
            },
        }),
        auth({
            auth: true,
            scopes: ["write:notifications"],
            permissions: [RolePermission.ManageOwnNotifications],
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

            const notification = await Notification.fromId(id);

            if (!notification || notification.data.notifiedId !== user.id) {
                throw ApiError.notificationNotFound();
            }

            await notification.update({
                dismissed: true,
            });

            return context.text("", 200);
        },
    ),
);
