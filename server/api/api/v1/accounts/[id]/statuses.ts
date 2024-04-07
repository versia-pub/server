import { apiRoute, applyConfig } from "@api";
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { statusToAPI } from "~database/entities/Status";
import {
    statusAndUserRelations,
    userRelations,
} from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/statuses",
    auth: {
        required: false,
        oauthPermissions: ["read:statuses"],
    },
});

/**
 * Fetch all statuses for a user
 */
export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: string;
    only_media?: boolean;
    exclude_replies?: boolean;
    exclude_reblogs?: boolean;
    // TODO: Add with_muted
    pinned?: boolean;
    tagged?: string;
}>(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    // TODO: Add pinned
    const {
        max_id,
        min_id,
        since_id,
        limit = "20",
        exclude_reblogs,
        pinned,
    } = extraData.parsedRequest;

    const user = await client.user.findUnique({
        where: { id },
        include: userRelations,
    });

    if (!user) return errorResponse("User not found", 404);

    if (pinned) {
        const objects = await client.status.findMany({
            where: {
                authorId: id,
                isReblog: false,
                pinnedBy: {
                    some: {
                        id: user.id,
                    },
                },
                id: {
                    lt: max_id,
                    gt: min_id,
                    gte: since_id,
                },
            },
            include: statusAndUserRelations,
            take: Number(limit),
            orderBy: {
                id: "desc",
            },
        });

        // Constuct HTTP Link header (next and prev) only if there are more statuses
        const linkHeader = [];

        if (objects.length > 0) {
            // Check if there are statuses before the first one
            const objectsBefore = await client.status.findMany({
                where: {
                    authorId: id,
                    isReblog: false,
                    pinnedBy: {
                        some: {
                            id: user.id,
                        },
                    },
                    id: {
                        lt: objects[0].id,
                    },
                },
                take: 1,
            });

            if (objectsBefore.length > 0) {
                const urlWithoutQuery = req.url.split("?")[0];
                // Add prev link
                linkHeader.push(
                    `<${urlWithoutQuery}?min_id=${objects[0].id}>; rel="prev"`,
                );
            }

            // Check if there are statuses after the last one
            const objectsAfter = await client.status.findMany({
                where: {
                    authorId: id,
                    isReblog: false,
                    pinnedBy: {
                        some: {
                            id: user.id,
                        },
                    },
                    id: {
                        gt: objects.at(-1)?.id,
                    },
                },
                take: 1,
            });

            if (objectsAfter.length > 0) {
                const urlWithoutQuery = req.url.split("?")[0];
                // Add next link
                linkHeader.push(
                    `<${urlWithoutQuery}?max_id=${
                        objects.at(-1)?.id
                    }>; rel="next"`,
                );
            }
        }

        return jsonResponse(
            await Promise.all(
                objects.map((status) => statusToAPI(status, user)),
            ),
            200,
            {
                Link: linkHeader.join(", "),
            },
        );
    }

    const objects = await client.status.findMany({
        where: {
            authorId: id,
            isReblog: exclude_reblogs ? true : undefined,
            id: {
                lt: max_id,
                gt: min_id,
                gte: since_id,
            },
        },
        include: statusAndUserRelations,
        take: Number(limit),
        orderBy: {
            id: "desc",
        },
    });

    // Constuct HTTP Link header (next and prev) only if there are more statuses
    const linkHeader = [];
    if (objects.length > 0) {
        // Check if there are statuses before the first one
        const objectsBefore = await client.status.findMany({
            where: {
                authorId: id,
                isReblog: exclude_reblogs ? true : undefined,
                id: {
                    lt: objects[0].id,
                },
            },
            take: 1,
        });

        if (objectsBefore.length > 0) {
            const urlWithoutQuery = req.url.split("?")[0];
            // Add prev link
            linkHeader.push(
                `<${urlWithoutQuery}?min_id=${objects[0].id}>; rel="prev"`,
            );
        }

        // Check if there are statuses after the last one
        const objectsAfter = await client.status.findMany({
            where: {
                authorId: id,
                isReblog: exclude_reblogs ? true : undefined,
                id: {
                    gt: objects.at(-1)?.id,
                },
            },
            take: 1,
        });

        if (objectsAfter.length > 0) {
            const urlWithoutQuery = req.url.split("?")[0];
            // Add next link
            linkHeader.push(
                `<${urlWithoutQuery}?max_id=${objects.at(-1)?.id}>; rel="next"`,
            );
        }
    }

    return jsonResponse(
        await Promise.all(objects.map((status) => statusToAPI(status, user))),
        200,
        {
            Link: linkHeader.join(", "),
        },
    );
});
