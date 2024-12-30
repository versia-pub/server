import { apiRoute, applyConfig, auth, idValidator } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note, Timeline, User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/favourited_by",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ViewNotes, RolePermissions.ViewNoteLikes],
    },
});

export const schemas = {
    query: z.object({
        max_id: z.string().regex(idValidator).optional(),
        since_id: z.string().regex(idValidator).optional(),
        min_id: z.string().regex(idValidator).optional(),
        limit: z.coerce.number().int().min(1).max(80).default(40),
    }),
    param: z.object({
        id: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/statuses/{id}/favourited_by",
    summary: "Get users who favourited a status",
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ViewNotes,
                RolePermissions.ViewNoteLikes,
            ],
        }),
    ] as const,
    request: {
        params: schemas.param,
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Users who favourited a status",
            content: {
                "application/json": {
                    schema: z.array(User.schema),
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
        const { max_id, since_id, min_id, limit } = context.req.valid("query");
        const { id } = context.req.valid("param");

        const { user } = context.get("auth");

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

        const note = await Note.fromId(id, user?.id);

        if (!(note && (await note?.isViewableByUser(user)))) {
            throw new ApiError(404, "Note not found");
        }

        const { objects, link } = await Timeline.getUserTimeline(
            and(
                max_id ? lt(Users.id, max_id) : undefined,
                since_id ? gte(Users.id, since_id) : undefined,
                min_id ? gt(Users.id, min_id) : undefined,
                sql`EXISTS (SELECT 1 FROM "Likes" WHERE "Likes"."likedId" = ${note.id} AND "Likes"."likerId" = ${Users.id})`,
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
