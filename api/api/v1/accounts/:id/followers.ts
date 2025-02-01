import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Timeline, User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";

const schemas = {
    query: z.object({
        max_id: z.string().uuid().optional(),
        since_id: z.string().uuid().optional(),
        min_id: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(40).optional().default(20),
    }),
    param: z.object({
        id: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}/followers",
    summary: "Get account followers",
    description:
        "Gets an paginated list of accounts that follow the specified account",
    middleware: [
        auth({
            auth: false,
            scopes: ["read:accounts"],
            permissions: [
                RolePermissions.ViewAccountFollows,
                RolePermissions.ViewAccounts,
            ],
        }),
        withUserParam,
    ] as const,
    request: {
        params: schemas.param,
        query: schemas.query,
    },
    responses: {
        200: {
            description: "A list of accounts that follow the specified account",
            content: {
                "application/json": {
                    schema: z.array(User.schema),
                },
            },
            headers: {
                Link: {
                    description: "Links to the next and previous pages",
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { max_id, since_id, min_id, limit } = context.req.valid("query");
        const otherUser = context.get("user");

        // TODO: Add follower/following privacy settings
        const { objects, link } = await Timeline.getUserTimeline(
            and(
                max_id ? lt(Users.id, max_id) : undefined,
                since_id ? gte(Users.id, since_id) : undefined,
                min_id ? gt(Users.id, min_id) : undefined,
                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${otherUser.id} AND "Relationships"."ownerId" = ${Users.id} AND "Relationships"."following" = true)`,
            ),
            limit,
            new URL(context.req.url),
        );

        return context.json(
            await Promise.all(objects.map((object) => object.toApi())),
            200,
            {
                Link: link,
            },
        );
    }),
);
