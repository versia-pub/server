import { apiRoute, auth, withUserParam } from "@/api";
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
        limit: z.coerce.number().int().min(1).max(40).optional().default(20),
    }),
    param: z.object({
        id: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}/following",
    summary: "Get account following",
    description:
        "Gets an paginated list of accounts that the specified account follows",
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
            description:
                "A list of accounts that the specified account follows",
            content: {
                "application/json": {
                    schema: z.array(Account),
                },
            },
            headers: {
                Link: {
                    description: "Link to the next page of results",
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { max_id, since_id, min_id } = context.req.valid("query");
        const otherUser = context.get("user");

        // TODO: Add follower/following privacy settings

        const { objects, link } = await Timeline.getUserTimeline(
            and(
                max_id ? lt(Users.id, max_id) : undefined,
                since_id ? gte(Users.id, since_id) : undefined,
                min_id ? gt(Users.id, min_id) : undefined,
                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Users.id} AND "Relationships"."ownerId" = ${otherUser.id} AND "Relationships"."following" = true)`,
            ),
            context.req.valid("query").limit,
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
