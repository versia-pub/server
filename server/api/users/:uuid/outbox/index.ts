import { applyConfig, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { Notes } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Note } from "~/packages/database-interface/note";
import { User } from "~/packages/database-interface/user";

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

const NOTES_PER_PAGE = 20;

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("query", schemas.query, handleZodError),
        async (context) => {
            const { uuid } = context.req.valid("param");

            const author = await User.fromId(uuid);

            if (!author) {
                return errorResponse("User not found", 404);
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

            const totalNotes = (
                await db
                    .select({
                        count: count(),
                    })
                    .from(Notes)
                    .where(
                        and(
                            eq(Notes.authorId, uuid),
                            inArray(Notes.visibility, ["public", "unlisted"]),
                        ),
                    )
            )[0].count;

            return jsonResponse({
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
                total_items: totalNotes,
                // Server actor
                author: author.getUri(),
                next:
                    notes.length === NOTES_PER_PAGE
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
