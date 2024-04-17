import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "~drizzle/db";
import { status } from "~drizzle/schema";
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

export default apiRoute(async (req, matchedRoute, extraData) => {
    const uuid = matchedRoute.params.uuid;
    const pageNumber = Number(matchedRoute.query.page) || 1;
    const config = await extraData.configManager.getConfig();
    const host = new URL(config.http.base_url).hostname;

    const notes = await Note.manyFromSql(
        and(
            eq(status.authorId, uuid),
            inArray(status.visibility, ["public", "unlisted"]),
        ),
        undefined,
        20,
        20 * (pageNumber - 1),
    );

    const totalNotes = await db
        .select({
            count: count(),
        })
        .from(status)
        .where(
            and(
                eq(status.authorId, uuid),
                inArray(status.visibility, ["public", "unlisted"]),
            ),
        );

    return jsonResponse({
        first: `${host}/users/${uuid}/outbox?page=1`,
        last: `${host}/users/${uuid}/outbox?page=1`,
        total_items: totalNotes,
        // Server actor
        author: new URL("/users/actor", config.http.base_url).toString(),
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
});
