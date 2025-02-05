import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Timeline } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { Account } from "~/classes/schemas/account";

const schemas = {
    query: z.object({
        max_id: z.string().uuid().optional(),
        since_id: z.string().uuid().optional(),
        min_id: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(80).default(40),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/blocks",
    summary: "Get blocks",
    description: "Get users you have blocked",
    middleware: [
        auth({
            auth: true,
            scopes: ["read:blocks"],
            permissions: [RolePermissions.ManageOwnBlocks],
        }),
    ] as const,
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Blocks",
            content: {
                "application/json": {
                    schema: z.array(Account),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { max_id, since_id, min_id, limit } = context.req.valid("query");

        const { user } = context.get("auth");

        const { objects: blocks, link } = await Timeline.getUserTimeline(
            and(
                max_id ? lt(Users.id, max_id) : undefined,
                since_id ? gte(Users.id, since_id) : undefined,
                min_id ? gt(Users.id, min_id) : undefined,
                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Users.id} AND "Relationships"."ownerId" = ${user.id} AND "Relationships"."blocking" = true)`,
            ),
            limit,
            new URL(context.req.url),
        );

        return context.json(
            blocks.map((u) => u.toApi()),
            200,
            {
                Link: link,
            },
        );
    }),
);
