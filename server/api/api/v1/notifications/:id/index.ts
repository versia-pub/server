import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { findManyNotifications } from "~/database/entities/Notification";

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
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth),
        async (context) => {
            const { id } = context.req.valid("param");

            const { user } = context.req.valid("header");
            if (!user) return errorResponse("Unauthorized", 401);

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

            if (!notification)
                return errorResponse("Notification not found", 404);

            return jsonResponse(notification);
        },
    );
