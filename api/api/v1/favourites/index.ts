import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Status as StatusSchema } from "@versia/client-ng/schemas";
import { Timeline } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, gt, gte, lt, sql } from "drizzle-orm";

const route = createRoute({
    method: "get",
    path: "/api/v1/favourites",
    summary: "View favourited statuses",
    description: "Statuses the user has favourited.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/favourites/#get",
    },
    tags: ["Favourites"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnLikes],
        }),
    ] as const,
    request: {
        query: z.object({
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
            limit: z.coerce.number().int().min(1).max(80).default(40).openapi({
                description: "Maximum number of results to return.",
            }),
        }),
    },
    responses: {
        200: {
            description: "List of favourited statuses",
            content: {
                "application/json": {
                    schema: z.array(StatusSchema),
                },
            },
            headers: z.object({
                link: z
                    .string()
                    .optional()
                    .openapi({
                        description: "Links to the next and previous pages",
                        example:
                            '<https://versia.social/api/v1/favourites?limit=2&max_id=359ae97f-78dd-43e7-8e13-1d8e1d7829b5>; rel="next", <https://versia.social/api/v1/favourites?limit=2&since_id=75e9f5a9-f455-48eb-8f60-435b4a088bc0>; rel="prev"',
                        externalDocs: {
                            url: "https://docs.joinmastodon.org/api/guidelines/#pagination",
                        },
                    }),
            }),
        },
        ...reusedResponses,
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
