import { apiRoute, applyConfig, auth, idValidator } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { and, eq, gt, gte, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { Notes, RolePermissions } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";
import { Timeline } from "~/packages/database-interface/timeline";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 200,
        duration: 60,
    },
    route: "/api/v1/timelines/home",
    auth: {
        required: true,
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnNotes,
            RolePermissions.ViewNotes,
            RolePermissions.ViewAccounts,
            RolePermissions.ViewPrimateTimelines,
        ],
    },
});

export const schemas = {
    query: z.object({
        max_id: z.string().regex(idValidator).optional(),
        since_id: z.string().regex(idValidator).optional(),
        min_id: z.string().regex(idValidator).optional(),
        limit: z.coerce.number().int().min(1).max(80).default(20),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/timelines/home",
    summary: "Get home timeline",
    middleware: [auth(meta.auth, meta.permissions)],
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
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { max_id, since_id, min_id, limit } = context.req.valid("query");

        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const { objects, link } = await Timeline.getNoteTimeline(
            and(
                and(
                    max_id ? lt(Notes.id, max_id) : undefined,
                    since_id ? gte(Notes.id, since_id) : undefined,
                    min_id ? gt(Notes.id, min_id) : undefined,
                ),
                or(
                    eq(Notes.authorId, user.id),
                    sql`EXISTS (SELECT 1 FROM "NoteToMentions" WHERE "NoteToMentions"."noteId" = ${Notes.id} AND "NoteToMentions"."userId" = ${user.id})`,
                    sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Notes.authorId} AND "Relationships"."ownerId" = ${user.id} AND "Relationships"."following" = true)`,
                ),
                sql`NOT EXISTS (SELECT 1 FROM "Filters" WHERE "Filters"."userId" = ${user.id} AND "Filters"."filter_action" = 'hide' AND EXISTS (SELECT 1 FROM "FilterKeywords" WHERE "FilterKeywords"."filterId" = "Filters"."id" AND "Notes"."content" LIKE '%' || "FilterKeywords"."keyword" || '%') AND "Filters"."context" @> ARRAY['home'])`,
            ),
            limit,
            context.req.url,
            user.id,
        );

        return context.json(
            await Promise.all(objects.map(async (note) => note.toApi(user))),
            200,
            {
                Link: link,
            },
        );
    }),
);
