import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note, Timeline } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, eq, gt, gte, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

const schemas = {
    query: z.object({
        max_id: z.string().uuid().optional(),
        since_id: z.string().uuid().optional(),
        min_id: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(80).default(20),
        local: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        remote: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        only_media: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/timelines/public",
    summary: "Get public timeline",
    middleware: [
        auth({
            auth: false,
            permissions: [
                RolePermissions.ViewNotes,
                RolePermissions.ViewAccounts,
                RolePermissions.ViewPublicTimelines,
            ],
        }),
    ] as const,
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Public timeline",
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
        const { max_id, since_id, min_id, limit, local, remote, only_media } =
            context.req.valid("query");

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
                              inArray(Notes.visibility, ["public", "private"]),
                          ),
                          eq(Notes.visibility, "public"),
                      )
                    : eq(Notes.visibility, "public"),
            ),
            limit,
            context.req.url,
            user?.id,
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
