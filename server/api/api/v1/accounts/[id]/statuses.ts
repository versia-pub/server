import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { client } from "~database/datasource";
import {
    statusToAPI,
    type StatusWithRelations,
} from "~database/entities/Status";
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
        only_media = false,
        pinned,
    } = extraData.parsedRequest;

    const user = await client.user.findUnique({
        where: { id },
        include: userRelations,
    });

    if (!user) return errorResponse("User not found", 404);

    if (pinned) {
        const { objects, link } = await fetchTimeline<StatusWithRelations>(
            client.status,
            {
                where: {
                    authorId: id,
                    isReblog: false,
                    pinnedBy: {
                        some: {
                            id: user.id,
                        },
                    },
                    // If only_media is true, only return statuses with attachments
                    attachments: only_media ? { some: {} } : undefined,
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
            },
            req,
        );

        return jsonResponse(
            await Promise.all(
                objects.map((status) => statusToAPI(status, user)),
            ),
            200,
            {
                Link: link,
            },
        );
    }

    const { objects, link } = await fetchTimeline<StatusWithRelations>(
        client.status,
        {
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
        },
        req,
    );

    return jsonResponse(
        await Promise.all(objects.map((status) => statusToAPI(status, user))),
        200,
        {
            Link: link,
        },
    );
});
