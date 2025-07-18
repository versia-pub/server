import * as VersiaEntities from "@versia/sdk/entities";
import { CollectionSchema, NoteSchema } from "@versia/sdk/schemas";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { db, Note, User } from "@versia-server/kit/db";
import { Notes } from "@versia-server/kit/tables";
import { and, eq, inArray } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";

const NOTES_PER_PAGE = 20;

export default apiRoute((app) =>
    app.get(
        "/users/:uuid/outbox",
        describeRoute({
            summary: "Get user outbox",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "User outbox",
                    content: {
                        "application/json": {
                            schema: resolver(
                                CollectionSchema.extend({
                                    items: z.array(NoteSchema),
                                }),
                            ),
                        },
                    },
                },
                404: {
                    description: "User not found",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                403: {
                    description: "Cannot view users from remote instances",
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
                uuid: z.uuid(),
            }),
            handleZodError,
        ),
        validator(
            "query",
            z.object({
                page: z.string().optional(),
            }),
            handleZodError,
        ),
        async (context) => {
            const { uuid } = context.req.valid("param");

            const author = await User.fromId(uuid);

            if (!author) {
                throw new ApiError(404, "User not found");
            }

            if (author.remote) {
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

            const json = new VersiaEntities.Collection({
                first: new URL(
                    `/users/${uuid}/outbox?page=1`,
                    config.http.base_url,
                ).href,
                last: new URL(
                    `/users/${uuid}/outbox?page=${Math.ceil(
                        totalNotes / NOTES_PER_PAGE,
                    )}`,
                    config.http.base_url,
                ).href,
                total: totalNotes,
                author: author.uri.href,
                next:
                    notes.length === NOTES_PER_PAGE
                        ? new URL(
                              `/users/${uuid}/outbox?page=${pageNumber + 1}`,
                              config.http.base_url,
                          ).href
                        : null,
                previous:
                    pageNumber > 1
                        ? new URL(
                              `/users/${uuid}/outbox?page=${pageNumber - 1}`,
                              config.http.base_url,
                          ).href
                        : null,
                items: notes.map((note) => note.toVersia()),
            });

            const { headers } = await author.sign(
                json,
                new URL(context.req.url),
                "GET",
            );

            return context.json(json, 200, headers.toJSON());
        },
    ),
);
