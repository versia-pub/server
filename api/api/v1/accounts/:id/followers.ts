import {
    accountNotFound,
    apiRoute,
    auth,
    reusedResponses,
    withUserParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Timeline } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { Account } from "~/classes/schemas/account";
import { Account as AccountSchema } from "~/classes/schemas/account";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}/followers",
    summary: "Get account’s followers",
    description:
        "Accounts which follow the given account, if network is not hidden by the account owner.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#followers",
    },
    tags: ["Accounts"],
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
        params: z.object({
            id: AccountSchema.shape.id,
        }),
        query: z.object({
            max_id: AccountSchema.shape.id.optional().openapi({
                description:
                    "All results returned will be lesser than this ID. In effect, sets an upper bound on results.",
                example: "8d35243d-b959-43e2-8bac-1a9d4eaea2aa",
            }),
            since_id: AccountSchema.shape.id.optional().openapi({
                description:
                    "All results returned will be greater than this ID. In effect, sets a lower bound on results.",
                example: undefined,
            }),
            min_id: AccountSchema.shape.id.optional().openapi({
                description:
                    "Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.",
                example: undefined,
            }),
            limit: z.number().int().min(1).max(40).default(20).openapi({
                description: "Maximum number of results to return.",
            }),
        }),
    },
    responses: {
        200: {
            description: "Accounts which follow the given account.",
            content: {
                "application/json": {
                    schema: z.array(Account),
                },
            },
            headers: z.object({
                link: z
                    .string()
                    .optional()
                    .openapi({
                        description: "Links to the next and previous pages",
                        example:
                            '<https://versia.social/api/v1/accounts/46be88d3-25b4-4edc-8be9-c28c4ac5ea95/followers?limit=2&max_id=359ae97f-78dd-43e7-8e13-1d8e1d7829b5>; rel="next", <https://versia.social/api/v1/accounts/46be88d3-25b4-4edc-8be9-c28c4ac5ea95/followers?limit=2&since_id=75e9f5a9-f455-48eb-8f60-435b4a088bc0>; rel="prev"',
                        externalDocs: {
                            url: "https://docs.joinmastodon.org/api/guidelines/#pagination",
                        },
                    }),
            }),
        },
        404: accountNotFound,
        422: reusedResponses[422],
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
