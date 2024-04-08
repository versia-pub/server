import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";
import { client } from "~database/datasource";
import { statusToLysand } from "~database/entities/Status";
import { statusAndUserRelations } from "~database/entities/relations";

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

/**
 * ActivityPub user outbox endpoint
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const uuid = matchedRoute.params.uuid;
    const pageNumber = Number(matchedRoute.query.page) || 1;
    const config = await extraData.configManager.getConfig();
    const host = new URL(config.http.base_url).hostname;

    const statuses = await client.status.findMany({
        where: {
            authorId: uuid,
            visibility: {
                in: ["public", "unlisted"],
            },
        },
        take: 20,
        skip: 20 * (pageNumber - 1),
        include: statusAndUserRelations,
    });

    const totalStatuses = await client.status.count({
        where: {
            authorId: uuid,
            visibility: {
                in: ["public", "unlisted"],
            },
        },
    });

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
