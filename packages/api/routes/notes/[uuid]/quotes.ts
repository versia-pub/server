import { Status as StatusSchema } from "@versia/client/schemas";
import * as VersiaEntities from "@versia/sdk/entities";
import { URICollectionSchema } from "@versia/sdk/schemas";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { db, Note } from "@versia-server/kit/db";
import { Notes } from "@versia-server/kit/tables";
import { and, eq, inArray } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";

export default apiRoute((app) =>
    app.get(
        "/notes/:id/quotes",
        describeRoute({
            summary: "Retrieve all quotes of a Versia Note.",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Note quotes",
                    content: {
                        "application/json": {
                            schema: resolver(URICollectionSchema),
                        },
                    },
                },
                404: {
                    description:
                        "Entity not found, is remote, or the requester is not allowed to view it.",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
            },
        }),
        validator(
            "param",
            z.object({
                id: StatusSchema.shape.id,
            }),
            handleZodError,
        ),
        validator(
            "query",
            z.object({
                limit: z.coerce.number().int().min(1).max(100).default(40),
                offset: z.coerce.number().int().nonnegative().default(0),
            }),
            handleZodError,
        ),
        async (context) => {
            const { id } = context.req.valid("param");
            const { limit, offset } = context.req.valid("query");

            const note = await Note.fromSql(
                and(
                    eq(Notes.id, id),
                    inArray(Notes.visibility, ["public", "unlisted"]),
                ),
            );

            if (!(note && (await note.isViewableByUser(null))) || note.remote) {
                throw ApiError.noteNotFound();
            }

            const quotes = await Note.manyFromSql(
                and(
                    eq(Notes.quotingId, note.id),
                    inArray(Notes.visibility, ["public", "unlisted"]),
                ),
                undefined,
                limit,
                offset,
            );

            const quoteCount = await db.$count(
                Notes,
                and(
                    eq(Notes.quotingId, note.id),
                    inArray(Notes.visibility, ["public", "unlisted"]),
                ),
            );

            const uriCollection = new VersiaEntities.URICollection({
                author: note.author.uri.href,
                first: new URL(
                    `/notes/${note.id}/quotes?offset=0`,
                    config.http.base_url,
                ).href,
                last:
                    quoteCount > limit
                        ? new URL(
                              `/notes/${note.id}/quotes?offset=${
                                  quoteCount - limit
                              }`,
                              config.http.base_url,
                          ).href
                        : new URL(
                              `/notes/${note.id}/quotes`,
                              config.http.base_url,
                          ).href,
                next:
                    offset + limit < quoteCount
                        ? new URL(
                              `/notes/${note.id}/quotes?offset=${
                                  offset + limit
                              }`,
                              config.http.base_url,
                          ).href
                        : null,
                previous:
                    offset - limit >= 0
                        ? new URL(
                              `/notes/${note.id}/quotes?offset=${
                                  offset - limit
                              }`,
                              config.http.base_url,
                          ).href
                        : null,
                total: quoteCount,
                items: quotes.map((reply) => reply.getUri().href),
            });

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
        },
    ),
);
