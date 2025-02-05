import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Note, Timeline } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, eq, gt, gte, inArray, lt, or, sql } from "drizzle-orm";

const schemas = {
    query: z.object({
        max_id: z.string().uuid().optional(),
        since_id: z.string().uuid().optional(),
        min_id: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(80).default(20),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/timelines/home",
    summary: "Get home timeline",
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnNotes,
                RolePermissions.ViewNotes,
                RolePermissions.ViewAccounts,
                RolePermissions.ViewPrivateTimelines,
            ],
        }),
    ] as const,
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Home timeline",
            content: {
                "application/json": {
                    schema: z.array(Note.schema),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { max_id, since_id, min_id, limit } = context.req.valid("query");

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
    }),
);
