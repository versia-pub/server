import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { Notifications, RolePermissions } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    allowedMethods: ["DELETE"],
    route: "/api/v1/notifications/destroy_multiple",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["write:notifications"],
    },
    permissions: {
        required: [RolePermissions.ManageOwnNotifications],
    },
});

export const schemas = {
    query: z.object({
        "ids[]": z.array(z.string().uuid()),
    }),
};

const route = createRoute({
    method: "delete",
    path: "/api/v1/notifications/destroy_multiple",
    summary: "Dismiss multiple notifications",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Notifications dismissed",
        },
        401: {
            description: "Unauthorized",
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
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const { "ids[]": ids } = context.req.valid("query");

        await db
            .update(Notifications)
            .set({
                dismissed: true,
            })
            .where(
                and(
                    inArray(Notifications.id, ids),
                    eq(Notifications.notifiedId, user.id),
                ),
            );

        return context.newResponse(null, 200);
    }),
);
