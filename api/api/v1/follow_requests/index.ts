import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Timeline } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { Account as AccountSchema } from "~/classes/schemas/account";

const route = createRoute({
    method: "get",
    path: "/api/v1/follow_requests",
    summary: "View pending follow requests",
    description: "Get a list of follow requests that the user has received.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/follow_requests/#get",
    },
    tags: ["Follows"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnFollows],
        }),
    ] as const,
    request: {
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
            limit: z.coerce.number().int().min(1).max(80).default(40).openapi({
                description: "Maximum number of results to return.",
            }),
        }),
    },
    responses: {
        200: {
            description:
                "List of accounts that have requested to follow the user",
            content: {
                "application/json": {
                    schema: z.array(AccountSchema),
                },
            },
            headers: z.object({
                link: z
                    .string()
                    .optional()
                    .openapi({
                        description: "Links to the next and previous pages",
                        example:
                            '<https://versia.social/api/v1/follow_requests?limit=2&max_id=359ae97f-78dd-43e7-8e13-1d8e1d7829b5>; rel="next", <https://versia.social/api/v1/follow_requests?limit=2&since_id=75e9f5a9-f455-48eb-8f60-435b4a088bc0>; rel="prev"',
                        externalDocs: {
                            url: "https://docs.joinmastodon.org/api/guidelines/#pagination",
                        },
                    }),
            }),
        },
        ...reusedResponses,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { max_id, since_id, min_id, limit } = context.req.valid("query");

        const { user } = context.get("auth");

        const { objects: followRequests, link } =
            await Timeline.getUserTimeline(
                and(
                    max_id ? lt(Users.id, max_id) : undefined,
                    since_id ? gte(Users.id, since_id) : undefined,
                    min_id ? gt(Users.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${user.id} AND "Relationships"."ownerId" = ${Users.id} AND "Relationships"."requested" = true)`,
                ),
                limit,
                new URL(context.req.url),
            );

        return context.json(
            followRequests.map((u) => u.toApi()),
            200,
            {
                Link: link,
            },
        );
    }),
);
