import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Timeline } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { Status } from "~/classes/schemas/status";

const schemas = {
    query: z.object({
        max_id: z.string().uuid().optional(),
        since_id: z.string().uuid().optional(),
        min_id: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(80).default(40),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/favourites",
    summary: "Get favourites",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnLikes],
        }),
    ] as const,
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Favourites",
            content: {
                "application/json": {
                    schema: z.array(Status),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { max_id, since_id, min_id, limit } = context.req.valid("query");

        const { user } = context.get("auth");

        const { objects: favourites, link } = await Timeline.getNoteTimeline(
            and(
                max_id ? lt(Notes.id, max_id) : undefined,
                since_id ? gte(Notes.id, since_id) : undefined,
                min_id ? gt(Notes.id, min_id) : undefined,
                sql`EXISTS (SELECT 1 FROM "Likes" WHERE "Likes"."likedId" = ${Notes.id} AND "Likes"."likerId" = ${user.id})`,
            ),
            limit,
            new URL(context.req.url),
            user?.id,
        );

        return context.json(
            await Promise.all(favourites.map((note) => note.toApi(user))),
            200,
            {
                Link: link,
            },
        );
    }),
);
