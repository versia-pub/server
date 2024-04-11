import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { client } from "~database/datasource";
import {
    findManyStatuses,
    statusToAPI,
    type StatusWithRelations,
} from "~database/entities/Status";
import { statusAndUserRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 200,
        duration: 60,
    },
    route: "/api/v1/timelines/public",
    auth: {
        required: false,
    },
});

export default apiRoute<{
    local?: boolean;
    only_media?: boolean;
    remote?: boolean;
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;
    const {
        local,
        limit = 20,
        max_id,
        min_id,
        // only_media,
        remote,
        since_id,
    } = extraData.parsedRequest;

    if (limit < 1 || limit > 40) {
        return errorResponse("Limit must be between 1 and 40", 400);
    }

    if (local && remote) {
        return errorResponse("Cannot use both local and remote", 400);
    }

    const { objects, link } = await fetchTimeline<StatusWithRelations>(
        findManyStatuses,
        {
            // @ts-expect-error Yes I KNOW the types are wrong
            where: (status, { lt, gte, gt, and, isNull, isNotNull }) =>
                and(
                    max_id ? lt(status.id, max_id) : undefined,
                    since_id ? gte(status.id, since_id) : undefined,
                    min_id ? gt(status.id, min_id) : undefined,
                    remote
                        ? isNotNull(status.instanceId)
                        : local
                          ? isNull(status.instanceId)
                          : undefined,
                ),
            limit: Number(limit),
            // @ts-expect-error Yes I KNOW the types are wrong
            orderBy: (status, { desc }) => desc(status.id),
        },
        req,
    );

    return jsonResponse(
        await Promise.all(
            objects.map(async (status) =>
                statusToAPI(status, user || undefined),
            ),
        ),
        200,
        {
            Link: link,
        },
    );
});
