import { applyConfig, handleZodError } from "@api";
import { zValidator } from "@hono/zod-validator";
import { jsonResponse } from "@response";
import { and, count, eq, inArray } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { db } from "~drizzle/db";
import { Notes } from "~drizzle/schema";
import { config } from "~packages/config-manager";
import { Note } from "~packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/users/:uuid/outbox",
});

export const schemas = {
    param: z.object({
        uuid: z.string().uuid(),
    }),
    query: z.object({
        page: z.string().optional(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("query", schemas.query, handleZodError),
        async (context) => {
            const { uuid } = context.req.valid("param");

            const pageNumber = Number(context.req.valid("query").page) || 1;
            const host = new URL(config.http.base_url).hostname;

            const notes = await Note.manyFromSql(
                and(
                    eq(Notes.authorId, uuid),
                    inArray(Notes.visibility, ["public", "unlisted"]),
                ),
                undefined,
                20,
                20 * (pageNumber - 1),
            );

            const totalNotes = await db
                .select({
                    count: count(),
                })
                .from(Notes)
                .where(
                    and(
                        eq(Notes.authorId, uuid),
                        inArray(Notes.visibility, ["public", "unlisted"]),
                    ),
                );

            return jsonResponse({
                first: `${host}/users/${uuid}/outbox?page=1`,
                last: `${host}/users/${uuid}/outbox?page=1`,
                total_items: totalNotes,
                // Server actor
                author: new URL(
                    "/users/actor",
                    config.http.base_url,
                ).toString(),
                next:
                    notes.length === 20
                        ? new URL(
                              `/users/${uuid}/outbox?page=${pageNumber + 1}`,
                              config.http.base_url,
                          ).toString()
                        : undefined,
                prev:
                    pageNumber > 1
                        ? new URL(
                              `/users/${uuid}/outbox?page=${pageNumber - 1}`,
                              config.http.base_url,
                          ).toString()
                        : undefined,
                items: notes.map((note) => note.toLysand()),
            });
        },
    );
