import { applyConfig, auth, handleZodError, idValidator } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { and, eq, gt, gte, lt, or, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { Notes, RolePermissions } from "~/drizzle/schema";
import { Timeline } from "~/packages/database-interface/timeline";

export const meta = applyConfig({
    allowedMethods: ["GET"],
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
            RolePermissions.MANAGE_OWN_NOTES,
            RolePermissions.VIEW_NOTES,
            RolePermissions.VIEW_ACCOUNTS,
            RolePermissions.VIEW_PRIVATE_TIMELINES,
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

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { max_id, since_id, min_id, limit } =
                context.req.valid("query");

            const { user } = context.req.valid("header");

            if (!user) return errorResponse("Unauthorized", 401);

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

            return jsonResponse(
                await Promise.all(
                    objects.map(async (note) => note.toAPI(user)),
                ),
                200,
                {
                    Link: link,
                },
            );
        },
    );
