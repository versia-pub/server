import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { findManyNotifications } from "~/classes/functions/notification";
import { RolePermissions } from "~/drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/notifications/:id",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:notifications"],
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

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");

            const { user } = context.get("auth");
            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const notification = (
                await findManyNotifications(
                    {
                        where: (notification, { eq }) =>
                            eq(notification.id, id),
                        limit: 1,
                    },
                    user.id,
                )
            )[0];

            if (!notification) {
                return context.json({ error: "Notification not found" }, 404);
            }

            return context.json(notification);
        },
    ),
);
