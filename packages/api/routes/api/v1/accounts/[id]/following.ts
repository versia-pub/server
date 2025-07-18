import {
    Account as AccountSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import {
    apiRoute,
    auth,
    handleZodError,
    withUserParam,
} from "@versia-server/kit/api";
import { Timeline } from "@versia-server/kit/db";
import { Users } from "@versia-server/kit/tables";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.get(
        "/api/v1/accounts/:id/following",
        describeRoute({
            summary: "Get account’s following",
            description:
                "Accounts which the given account is following, if network is not hidden by the account owner.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#following",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description:
                        "Accounts which the given account is following.",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(AccountSchema)),
                        },
                    },
                    headers: {
                        link: z
                            .string()
                            .optional()
                            .meta({
                                description:
                                    "Links to the next and previous pages",
                                example:
                                    '<https://versia.social/api/v1/accounts/46be88d3-25b4-4edc-8be9-c28c4ac5ea95/following?limit=2&max_id=359ae97f-78dd-43e7-8e13-1d8e1d7829b5>; rel="next", <https://versia.social/api/v1/accounts/46be88d3-25b4-4edc-8be9-c28c4ac5ea95/following?limit=2&since_id=75e9f5a9-f455-48eb-8f60-435b4a088bc0>; rel="prev"',
                                externalDocs: {
                                    url: "https://docs.joinmastodon.org/api/guidelines/#pagination",
                                },
                            }),
                    },
                },
                404: ApiError.accountNotFound().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        withUserParam,
        auth({
            auth: false,
            scopes: ["read:accounts"],
            permissions: [
                RolePermission.ViewAccountFollows,
                RolePermission.ViewAccounts,
            ],
        }),
        validator(
            "query",
            z.object({
                max_id: AccountSchema.shape.id.optional().meta({
                    description:
                        "All results returned will be lesser than this ID. In effect, sets an upper bound on results.",
                    example: "8d35243d-b959-43e2-8bac-1a9d4eaea2aa",
                }),
                since_id: AccountSchema.shape.id.optional().meta({
                    description:
                        "All results returned will be greater than this ID. In effect, sets a lower bound on results.",
                    example: undefined,
                }),
                min_id: AccountSchema.shape.id.optional().meta({
                    description:
                        "Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.",
                    example: undefined,
                }),
                limit: z.number().int().min(1).max(40).default(20).meta({
                    description: "Maximum number of results to return.",
                }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { user: self } = context.get("auth");
            const { max_id, since_id, min_id } = context.req.valid("query");
            const otherUser = context.get("user");

            if (
                self?.id !== otherUser.id &&
                otherUser.data.isHidingCollections
            ) {
                return context.json([], 200, { Link: "" });
            }

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
        },
    ),
);
