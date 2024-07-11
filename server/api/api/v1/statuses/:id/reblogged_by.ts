import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { RolePermissions, Users } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";
import { Timeline } from "~/packages/database-interface/timeline";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/reblogged_by",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ViewNotes, RolePermissions.ViewNoteBoosts],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    query: z.object({
        max_id: z.string().uuid().optional(),
        since_id: z.string().uuid().optional(),
        min_id: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(80).default(40),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { max_id, min_id, since_id, limit } =
                context.req.valid("query");
            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const status = await Note.fromId(id, user.id);

            if (!status?.isViewableByUser(user)) {
                return errorResponse("Record not found", 404);
            }

            const { objects, link } = await Timeline.getUserTimeline(
                and(
                    max_id ? lt(Users.id, max_id) : undefined,
                    since_id ? gte(Users.id, since_id) : undefined,
                    min_id ? gt(Users.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."reblogId" = ${status.id} AND "Notes"."authorId" = ${Users.id})`,
                ),
                limit,
                context.req.url,
            );

            return jsonResponse(
                objects.map((user) => user.toApi()),
                200,
                {
                    Link: link,
                },
            );
        },
    );
