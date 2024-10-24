import { apiRoute, applyConfig, auth, idValidator } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { Timeline } from "~/classes/database/timeline";
import { User } from "~/classes/database/user";
import { RolePermissions, Users } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    route: "/api/v1/mutes",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:mutes"],
    },
    permissions: {
        required: [RolePermissions.ManageOwnMutes],
    },
});

export const schemas = {
    query: z.object({
        max_id: z.string().regex(idValidator).optional(),
        since_id: z.string().regex(idValidator).optional(),
        min_id: z.string().regex(idValidator).optional(),
        limit: z.coerce.number().int().min(1).max(80).default(40),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/mutes",
    summary: "Get muted users",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Muted users",
            content: {
                "application/json": {
                    schema: z.array(User.schema),
                },
            },
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
        const { max_id, since_id, limit, min_id } = context.req.valid("query");
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const { objects: mutes, link } = await Timeline.getUserTimeline(
            and(
                max_id ? lt(Users.id, max_id) : undefined,
                since_id ? gte(Users.id, since_id) : undefined,
                min_id ? gt(Users.id, min_id) : undefined,
                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Users.id} AND "Relationships"."ownerId" = ${user.id} AND "Relationships"."muting" = true)`,
            ),
            limit,
            context.req.url,
        );

        return context.json(
            mutes.map((u) => u.toApi()),
            200,
            {
                Link: link,
            },
        );
    }),
);
