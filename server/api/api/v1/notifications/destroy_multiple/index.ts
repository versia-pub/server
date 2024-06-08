import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { Notifications, RolePermissions } from "~/drizzle/schema";

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
        required: [RolePermissions.MANAGE_OWN_NOTIFICATIONS],
    },
});

export const schemas = {
    query: z.object({
        "ids[]": z.array(z.string().uuid()),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user } = context.req.valid("header");

            if (!user) return errorResponse("Unauthorized", 401);

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

            return jsonResponse({});
        },
    );
