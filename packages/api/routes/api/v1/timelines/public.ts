import {
    RolePermission,
    Status as StatusSchema,
    zBoolean,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Timeline } from "@versia-server/kit/db";
import { Notes } from "@versia-server/kit/tables";
import { and, eq, gt, gte, inArray, lt, or, sql } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.get(
        "/api/v1/timelines/public",
        describeRoute({
            summary: "View public timeline",
            description: "View public statuses.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/timelines/#public",
            },
            tags: ["Timelines"],
            responses: {
                200: {
                    description: "Public timeline",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(StatusSchema)),
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
                                    '<https://versia.social/api/v1/timelines/public?limit=2&max_id=359ae97f-78dd-43e7-8e13-1d8e1d7829b5>; rel="next", <https://versia.social/api/v1/timelines/public?limit=2&since_id=75e9f5a9-f455-48eb-8f60-435b4a088bc0>; rel="prev"',
                                externalDocs: {
                                    url: "https://docs.joinmastodon.org/api/guidelines/#pagination",
                                },
                            }),
                    },
                },
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: false,
            permissions: [
                RolePermission.ViewNotes,
                RolePermission.ViewAccounts,
                RolePermission.ViewPublicTimelines,
            ],
        }),
        validator(
            "query",
            z
                .object({
                    max_id: StatusSchema.shape.id.optional().meta({
                        description:
                            "All results returned will be lesser than this ID. In effect, sets an upper bound on results.",
                        example: "8d35243d-b959-43e2-8bac-1a9d4eaea2aa",
                    }),
                    since_id: StatusSchema.shape.id.optional().meta({
                        description:
                            "All results returned will be greater than this ID. In effect, sets a lower bound on results.",
                        example: undefined,
                    }),
                    min_id: StatusSchema.shape.id.optional().meta({
                        description:
                            "Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.",
                        example: undefined,
                    }),
                    local: zBoolean.default(false).meta({
                        description: "Show only local statuses?",
                    }),
                    remote: zBoolean.default(false).meta({
                        description: "Show only remote statuses?",
                    }),
                    only_media: zBoolean.default(false).meta({
                        description: "Show only statuses with media attached?",
                    }),
                    limit: z.coerce
                        .number()
                        .int()
                        .min(1)
                        .max(40)
                        .default(20)
                        .meta({
                            description: "Maximum number of results to return.",
                        }),
                })
                .refine(
                    (o) => !(o.local && o.remote),
                    "'local' and 'remote' cannot be both true",
                ),
            handleZodError,
        ),
        async (context) => {
            const {
                max_id,
                since_id,
                min_id,
                limit,
                local,
                remote,
                only_media,
            } = context.req.valid("query");

            const { user } = context.get("auth");

            const { objects, link } = await Timeline.getNoteTimeline(
                and(
                    max_id ? lt(Notes.id, max_id) : undefined,
                    since_id ? gte(Notes.id, since_id) : undefined,
                    min_id ? gt(Notes.id, min_id) : undefined,
                    remote
                        ? sql`EXISTS (SELECT 1 FROM "Users" WHERE "Users"."id" = ${Notes.authorId} AND "Users"."instanceId" IS NOT NULL)`
                        : undefined,
                    local
                        ? sql`EXISTS (SELECT 1 FROM "Users" WHERE "Users"."id" = ${Notes.authorId} AND "Users"."instanceId" IS NULL)`
                        : undefined,
                    only_media
                        ? sql`EXISTS (SELECT 1 FROM "Medias" WHERE "Medias"."noteId" = ${Notes.id})`
                        : undefined,
                    user
                        ? sql`NOT EXISTS (SELECT 1 FROM "Filters" WHERE "Filters"."userId" = ${user.id} AND "Filters"."filter_action" = 'hide' AND EXISTS (SELECT 1 FROM "FilterKeywords" WHERE "FilterKeywords"."filterId" = "Filters"."id" AND "Notes"."content" LIKE '%' || "FilterKeywords"."keyword" || '%') AND "Filters"."context" @> ARRAY['public'])`
                        : undefined,
                    // Visibility check
                    user
                        ? or(
                              eq(Notes.authorId, user.id),
                              sql`EXISTS (SELECT 1 FROM "NoteToMentions" WHERE "NoteToMentions"."noteId" = ${Notes.id} AND "NoteToMentions"."userId" = ${user.id})`,
                              and(
                                  sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Notes.authorId} AND "Relationships"."ownerId" = ${user.id} AND "Relationships"."following" = true)`,
                                  inArray(Notes.visibility, [
                                      "public",
                                      "private",
                                  ]),
                              ),
                              eq(Notes.visibility, "public"),
                          )
                        : eq(Notes.visibility, "public"),
                ),
                limit,
                new URL(context.req.url),
                user?.id,
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
