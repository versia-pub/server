import { apiRoute, auth, handleZodError } from "@/api";
import { Status as StatusSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Timeline } from "@versia/kit/db";
import { Notes } from "@versia/kit/tables";
import { and, eq, gt, gte, inArray, lt, or, sql } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.get(
        "/api/v1/timelines/home",
        describeRoute({
            summary: "View home timeline",
            description: "View statuses from followed users and hashtags.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/timelines/#home",
            },
            tags: ["Timelines"],
            responses: {
                200: {
                    description:
                        "Statuses in your home timeline will be returned",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(StatusSchema)),
                        },
                    },
                    headers: z.object({
                        link: z
                            .string()
                            .optional()
                            .openapi({
                                description:
                                    "Links to the next and previous pages",
                                example:
                                    '<https://versia.social/api/v1/timelines/home?limit=2&max_id=359ae97f-78dd-43e7-8e13-1d8e1d7829b5>; rel="next", <https://versia.social/api/v1/timelines/home?limit=2&since_id=75e9f5a9-f455-48eb-8f60-435b4a088bc0>; rel="prev"',
                                externalDocs: {
                                    url: "https://docs.joinmastodon.org/api/guidelines/#pagination",
                                },
                            }),
                    }),
                },
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnNotes,
                RolePermission.ViewNotes,
                RolePermission.ViewAccounts,
                RolePermission.ViewPrivateTimelines,
            ],
        }),
        validator(
            "query",
            z.object({
                max_id: StatusSchema.shape.id.optional().openapi({
                    description:
                        "All results returned will be lesser than this ID. In effect, sets an upper bound on results.",
                    example: "8d35243d-b959-43e2-8bac-1a9d4eaea2aa",
                }),
                since_id: StatusSchema.shape.id.optional().openapi({
                    description:
                        "All results returned will be greater than this ID. In effect, sets a lower bound on results.",
                    example: undefined,
                }),
                min_id: StatusSchema.shape.id.optional().openapi({
                    description:
                        "Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.",
                    example: undefined,
                }),
                limit: z.coerce
                    .number()
                    .int()
                    .min(1)
                    .max(40)
                    .default(20)
                    .openapi({
                        description: "Maximum number of results to return.",
                    }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { max_id, since_id, min_id, limit } =
                context.req.valid("query");

            const { user } = context.get("auth");

            const { objects, link } = await Timeline.getNoteTimeline(
                and(
                    and(
                        max_id ? lt(Notes.id, max_id) : undefined,
                        since_id ? gte(Notes.id, since_id) : undefined,
                        min_id ? gt(Notes.id, min_id) : undefined,
                    ),
                    // Visibility check
                    or(
                        eq(Notes.authorId, user.id),
                        sql`EXISTS (SELECT 1 FROM "NoteToMentions" WHERE "NoteToMentions"."noteId" = ${Notes.id} AND "NoteToMentions"."userId" = ${user.id})`,
                        and(
                            sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Notes.authorId} AND "Relationships"."ownerId" = ${user.id} AND "Relationships"."following" = true)`,
                            inArray(Notes.visibility, ["public", "private"]),
                        ),
                        eq(Notes.visibility, "public"),
                    ),
                    sql`NOT EXISTS (SELECT 1 FROM "Filters" WHERE "Filters"."userId" = ${user.id} AND "Filters"."filter_action" = 'hide' AND EXISTS (SELECT 1 FROM "FilterKeywords" WHERE "FilterKeywords"."filterId" = "Filters"."id" AND "Notes"."content" LIKE '%' || "FilterKeywords"."keyword" || '%') AND "Filters"."context" @> ARRAY['home'])`,
                ),
                limit,
                new URL(context.req.url),
                user.id,
            );

            return context.json(
                await Promise.all(objects.map((note) => note.toApi(user))),
                200,
                {
                    Link: link,
                },
            );
        },
    ),
);
