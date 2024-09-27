import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import {
    findManyNotifications,
    notificationToApi,
} from "~/classes/functions/notification";
import { RolePermissions } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";
import { User } from "~/packages/database-interface/user";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
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

const route = createRoute({
    method: "get",
    path: "/api/v1/notifications/{id}",
    summary: "Get notification",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Notification",
            schema: z.object({
                account: z.lazy(() => User.schema).nullable(),
                created_at: z.string(),
                id: z.string().uuid(),
                status: z.lazy(() => Note.schema).optional(),
                // TODO: Add reactions
                type: z.enum([
                    "mention",
                    "status",
                    "follow",
                    "follow_request",
                    "reblog",
                    "poll",
                    "favourite",
                    "update",
                    "admin.sign_up",
                    "admin.report",
                    "chat",
                    "pleroma:chat_mention",
                    "pleroma:emoji_reaction",
                    "pleroma:event_reminder",
                    "pleroma:participation_request",
                    "pleroma:participation_accepted",
                    "move",
                    "group_reblog",
                    "group_favourite",
                    "user_approved",
                ]),
                target: z.lazy(() => User.schema).optional(),
            }),
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
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
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");

        const { user } = context.get("auth");
        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const notification = (
            await findManyNotifications(
                {
                    where: (notification, { eq }) => eq(notification.id, id),
                    limit: 1,
                },
                user.id,
            )
        )[0];

        if (!notification) {
            return context.json({ error: "Notification not found" }, 404);
        }

        return context.json(await notificationToApi(notification), 200);
    }),
);
