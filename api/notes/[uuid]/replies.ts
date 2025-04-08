import { apiRoute, handleZodError } from "@/api";
import { Status as StatusSchema } from "@versia/client/schemas";
import { Note, db } from "@versia/kit/db";
import { Notes } from "@versia/kit/tables";
import * as VersiaEntities from "@versia/sdk/entities";
import { URICollectionSchema } from "@versia/sdk/schemas";
import { and, eq, inArray } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";

export default apiRoute((app) =>
    app.get(
        "/notes/:id/replies",
        describeRoute({
            summary: "Retrieve all replies to a Versia Note.",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Note replies",
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
            z.object({ id: StatusSchema.shape.id }),
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

            if (
                !(note && (await note.isViewableByUser(null))) ||
                note.isRemote()
            ) {
                throw ApiError.noteNotFound();
            }

            const replies = await Note.manyFromSql(
                and(
                    eq(Notes.replyId, note.id),
                    inArray(Notes.visibility, ["public", "unlisted"]),
                ),
                undefined,
                limit,
                offset,
            );

            const replyCount = await db.$count(
                Notes,
                and(
                    eq(Notes.replyId, note.id),
                    inArray(Notes.visibility, ["public", "unlisted"]),
                ),
            );

            const uriCollection = new VersiaEntities.URICollection({
                author: note.author.getUri(),
                first: new URL(
                    `/notes/${note.id}/replies?offset=0`,
                    config.http.base_url,
                ),
                last:
                    replyCount > limit
                        ? new URL(
                              `/notes/${note.id}/replies?offset=${replyCount - limit}`,
                              config.http.base_url,
                          )
                        : new URL(
                              `/notes/${note.id}/replies`,
                              config.http.base_url,
                          ),
                next:
                    offset + limit < replyCount
                        ? new URL(
                              `/notes/${note.id}/replies?offset=${offset + limit}`,
                              config.http.base_url,
                          )
                        : null,
                previous:
                    offset - limit >= 0
                        ? new URL(
                              `/notes/${note.id}/replies?offset=${offset - limit}`,
                              config.http.base_url,
                          )
                        : null,
                total: replyCount,
                items: replies.map((reply) => reply.getUri()),
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
