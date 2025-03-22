import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Status as StatusSchema } from "@versia/client-ng/schemas";
import { URICollection as URICollectionSchema } from "@versia/federation/schemas";
import type { URICollection } from "@versia/federation/types";
import { Note, db } from "@versia/kit/db";
import { Notes } from "@versia/kit/tables";
import { and, eq, inArray } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "get",
    path: "/notes/{id}/quotes",
    summary: "Retrieve all quotes of a Versia Note.",
    request: {
        params: z.object({
            id: StatusSchema.shape.id,
        }),
        query: z.object({
            limit: z.coerce.number().int().min(1).max(100).default(40),
            offset: z.coerce.number().int().nonnegative().default(0),
        }),
    },
    responses: {
        200: {
            description: "Note quotes",
            content: {
                "application/json": {
                    schema: URICollectionSchema,
                },
            },
        },
        404: {
            description:
                "Entity not found, is remote, or the requester is not allowed to view it.",
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
        const { limit, offset } = context.req.valid("query");

        const note = await Note.fromSql(
            and(
                eq(Notes.id, id),
                inArray(Notes.visibility, ["public", "unlisted"]),
            ),
        );

        if (!(note && (await note.isViewableByUser(null))) || note.isRemote()) {
            throw new ApiError(404, "Note not found");
        }

        const replies = await Note.manyFromSql(
            and(
                eq(Notes.quotingId, note.id),
                inArray(Notes.visibility, ["public", "unlisted"]),
            ),
            undefined,
            limit,
            offset,
        );

        const replyCount = await db.$count(
            Notes,
            and(
                eq(Notes.quotingId, note.id),
                inArray(Notes.visibility, ["public", "unlisted"]),
            ),
        );

        const uriCollection = {
            author: note.author.getUri().href,
            first: new URL(
                `/notes/${note.id}/quotes?offset=0`,
                config.http.base_url,
            ).href,
            last:
                replyCount > limit
                    ? new URL(
                          `/notes/${note.id}/quotes?offset=${replyCount - limit}`,
                          config.http.base_url,
                      ).href
                    : new URL(`/notes/${note.id}/quotes`, config.http.base_url)
                          .href,
            next:
                offset + limit < replyCount
                    ? new URL(
                          `/notes/${note.id}/quotes?offset=${offset + limit}`,
                          config.http.base_url,
                      ).href
                    : null,
            previous:
                offset - limit >= 0
                    ? new URL(
                          `/notes/${note.id}/quotes?offset=${offset - limit}`,
                          config.http.base_url,
                      ).href
                    : null,
            total: replyCount,
            items: replies.map((reply) => reply.getUri().href),
        } satisfies URICollection;

        // If base_url uses https and request uses http, rewrite request to use https
        // This fixes reverse proxy errors
        const reqUrl = new URL(context.req.url);
        if (
            config.http.base_url.protocol === "https:" &&
            reqUrl.protocol === "http:"
        ) {
            reqUrl.protocol = "https:";
        }

        const { headers } = await note.author.sign(
            uriCollection,
            reqUrl,
            "GET",
        );

        return context.json(uriCollection, 200, headers.toJSON());
    }),
);
