import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    LikeExtension as LikeSchema,
    Note as NoteSchema,
} from "@versia/federation/schemas";
import { Like, Note, User } from "@versia/kit/db";
import { Likes, Notes } from "@versia/kit/tables";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/packages/config-manager";
import { ErrorSchema, type KnownEntity } from "~/types/api";

const route = createRoute({
    method: "get",
    path: "/objects/{id}",
    summary: "Get object",
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
    },
    responses: {
        200: {
            description: "Object",
            content: {
                "application/json": {
                    schema: NoteSchema.or(LikeSchema),
                },
            },
        },
        404: {
            description: "Object not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        403: {
            description: "Cannot view objects from remote instances",
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

        let foundObject: Note | Like | null = null;
        let foundAuthor: User | null = null;
        let apiObject: KnownEntity | null = null;

        foundObject = await Note.fromSql(
            and(
                eq(Notes.id, id),
                inArray(Notes.visibility, ["public", "unlisted"]),
            ),
        );
        apiObject = foundObject ? foundObject.toVersia() : null;
        foundAuthor = foundObject ? foundObject.author : null;

        if (foundObject) {
            if (!(await foundObject.isViewableByUser(null))) {
                throw new ApiError(404, "Object not found");
            }
        } else {
            foundObject = await Like.fromSql(
                and(
                    eq(Likes.id, id),
                    sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."id" = ${Likes.likedId} AND "Notes"."visibility" IN ('public', 'unlisted'))`,
                ),
            );
            apiObject = foundObject ? foundObject.toVersia() : null;
            foundAuthor = foundObject
                ? await User.fromId(foundObject.data.likerId)
                : null;
        }

        if (!(foundObject && apiObject)) {
            throw new ApiError(404, "Object not found");
        }

        if (!foundAuthor) {
            throw new ApiError(404, "Author not found");
        }

        if (foundAuthor?.isRemote()) {
            throw new ApiError(403, "Object is from a remote instance");
        }
        // If base_url uses https and request uses http, rewrite request to use https
        // This fixes reverse proxy errors
        const reqUrl = new URL(context.req.url);
        if (
            new URL(config.http.base_url).protocol === "https:" &&
            reqUrl.protocol === "http:"
        ) {
            reqUrl.protocol = "https:";
        }

        const { headers } = await foundAuthor.sign(apiObject, reqUrl, "GET");

        return context.json(apiObject, 200, headers.toJSON());
    }),
);
