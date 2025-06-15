import {
    Account as AccountSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import {
    apiRoute,
    auth,
    handleZodError,
    withNoteParam,
} from "@versia-server/kit/api";
import { Timeline } from "@versia-server/kit/db";
import { Users } from "@versia-server/kit/tables";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";

export default apiRoute((app) =>
    app.get(
        "/api/v1/statuses/:id/reblogged_by",
        describeRoute({
            summary: "See who boosted a status",
            description: "View who boosted a given status.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#reblogged_by",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description: "A list of accounts that boosted the status",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(AccountSchema)),
                        },
                    },
                    headers: {
                        link: z
                            .string()
                            .optional()
                            .openapi({
                                description:
                                    "Links to the next and previous pages",
                                example:
                                    '<https://versia.social/api/v1/statuses/f048addc-49ca-4443-bdd8-a1b641ae8adc/reblogged_by?limit=2&max_id=359ae97f-78dd-43e7-8e13-1d8e1d7829b5>; rel="next", <https://versia.social/api/v1/statuses/f048addc-49ca-4443-bdd8-a1b641ae8adc/reblogged_by?limit=2&since_id=75e9f5a9-f455-48eb-8f60-435b4a088bc0>; rel="prev"',
                                externalDocs: {
                                    url: "https://docs.joinmastodon.org/api/guidelines/#pagination",
                                },
                            }),
                    },
                },
                404: ApiError.noteNotFound().schema,
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [
                RolePermission.ViewNotes,
                RolePermission.ViewNoteBoosts,
            ],
        }),
        withNoteParam,
        validator(
            "query",
            z.object({
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
                limit: z.coerce
                    .number()
                    .int()
                    .min(1)
                    .max(80)
                    .default(40)
                    .openapi({
                        description: "Maximum number of results to return.",
                    }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { max_id, min_id, since_id, limit } =
                context.req.valid("query");
            const note = context.get("note");

            const { objects, link } = await Timeline.getUserTimeline(
                and(
                    max_id ? lt(Users.id, max_id) : undefined,
                    since_id ? gte(Users.id, since_id) : undefined,
                    min_id ? gt(Users.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."reblogId" = ${note.id} AND "Notes"."authorId" = ${Users.id})`,
                ),
                limit,
                new URL(context.req.url),
            );

            return context.json(
                objects.map((user) => user.toApi()),
                200,
                {
                    Link: link,
                },
            );
        },
    ),
);
