import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";
import { and, count, eq, inArray } from "drizzle-orm";
import { findManyStatuses, statusToLysand } from "~database/entities/Status";
import { db } from "~drizzle/db";
import { status } from "~drizzle/schema";

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

    const statuses = await findManyStatuses({
        where: (status, { eq, and, inArray }) =>
            and(
                eq(status.authorId, uuid),
                inArray(status.visibility, ["public", "unlisted"]),
            ),
        offset: 20 * (pageNumber - 1),
        limit: 20,
        orderBy: (status, { desc }) => desc(status.createdAt),
    });

    const totalStatuses = await db
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
        total_items: totalStatuses,
        // Server actor
        author: new URL("/users/actor", config.http.base_url).toString(),
        next:
            statuses.length === 20
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
        items: statuses.map((s) => statusToLysand(s)),
    });
});
