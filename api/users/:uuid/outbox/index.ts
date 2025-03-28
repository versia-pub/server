import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Collection as CollectionSchema,
    Note as NoteSchema,
} from "@versia/federation/schemas";
import { Note, User, db } from "@versia/kit/db";
import { Notes } from "@versia/kit/tables";
import { and, eq, inArray } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";

const schemas = {
    param: z.object({
        uuid: z.string().uuid(),
    }),
    query: z.object({
        page: z.string().optional(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/users/{uuid}/outbox",
    summary: "Get user outbox",
    request: {
        params: schemas.param,
        query: schemas.query,
    },
    tags: ["Federation"],
    responses: {
        200: {
            description: "User outbox",
            content: {
                "application/json": {
                    schema: CollectionSchema.extend({
                        items: z.array(NoteSchema),
                    }),
                },
            },
        },
        404: {
            description: "User not found",
            content: {
                "application/json": {
                    schema: ApiError.zodSchema,
                },
            },
        },
        403: {
            description: "Cannot view users from remote instances",
            content: {
                "application/json": {
                    schema: ApiError.zodSchema,
                },
            },
        },
    },
});

const NOTES_PER_PAGE = 20;

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { uuid } = context.req.valid("param");

        const author = await User.fromId(uuid);

        if (!author) {
            throw new ApiError(404, "User not found");
        }

        if (author.isRemote()) {
            throw new ApiError(403, "User is not on this instance");
        }

        const pageNumber = Number(context.req.valid("query").page) || 1;

        const notes = await Note.manyFromSql(
            and(
                eq(Notes.authorId, uuid),
                inArray(Notes.visibility, ["public", "unlisted"]),
            ),
            undefined,
            NOTES_PER_PAGE,
            NOTES_PER_PAGE * (pageNumber - 1),
        );

        const totalNotes = await db.$count(
            Notes,
            and(
                eq(Notes.authorId, uuid),
                inArray(Notes.visibility, ["public", "unlisted"]),
            ),
        );

        const json = {
            first: new URL(
                `/users/${uuid}/outbox?page=1`,
                config.http.base_url,
            ).toString(),
            last: new URL(
                `/users/${uuid}/outbox?page=${Math.ceil(
                    totalNotes / NOTES_PER_PAGE,
                )}`,
                config.http.base_url,
            ).toString(),
            total: totalNotes,
            author: author.getUri().toString(),
            next:
                notes.length === NOTES_PER_PAGE
                    ? new URL(
                          `/users/${uuid}/outbox?page=${pageNumber + 1}`,
                          config.http.base_url,
                      ).toString()
                    : null,
            previous:
                pageNumber > 1
                    ? new URL(
                          `/users/${uuid}/outbox?page=${pageNumber - 1}`,
                          config.http.base_url,
                      ).toString()
                    : null,
            items: notes.map((note) => note.toVersia()),
        };

        const { headers } = await author.sign(
            json,
            new URL(context.req.url),
            "GET",
        );

        return context.json(json, 200, headers.toJSON());
    }),
);
