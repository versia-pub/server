import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note, Timeline, User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

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

const route = createRoute({
    method: "get",
    path: "/api/v1/statuses/{id}/reblogged_by",
    summary: "Get users who reblogged a status",
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ViewNotes,
                RolePermissions.ViewNoteBoosts,
            ],
        }),
    ] as const,
    request: {
        params: schemas.param,
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Users who reblogged a status",
            content: {
                "application/json": {
                    schema: z.array(User.schema),
                },
            },
        },

        404: {
            description: "Record not found",
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
        const { id } = context.req.valid("param");
        const { max_id, min_id, since_id, limit } = context.req.valid("query");
        const { user } = context.get("auth");

        const note = await Note.fromId(id, user.id);

        if (!(note && (await note?.isViewableByUser(user)))) {
            throw new ApiError(404, "Note not found");
        }

        const { objects, link } = await Timeline.getUserTimeline(
            and(
                max_id ? lt(Users.id, max_id) : undefined,
                since_id ? gte(Users.id, since_id) : undefined,
                min_id ? gt(Users.id, min_id) : undefined,
                sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."reblogId" = ${note.id} AND "Notes"."authorId" = ${Users.id})`,
            ),
            limit,
            context.req.url,
        );

        return context.json(
            objects.map((user) => user.toApi()),
            200,
            {
                Link: link,
            },
        );
    }),
);
