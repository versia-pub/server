import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
    type StatusWithRelations,
    findManyStatuses,
    statusToAPI,
} from "~database/entities/Status";

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

export const schema = z.object({
    max_id: z.string().regex(idValidator).optional(),
    since_id: z.string().regex(idValidator).optional(),
    min_id: z.string().regex(idValidator).optional(),
    limit: z.coerce.number().int().min(1).max(80).optional().default(20),
    local: z.coerce.boolean().optional(),
    remote: z.coerce.boolean().optional(),
    only_media: z.coerce.boolean().optional(),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { user } = extraData.auth;
        const { local, limit, max_id, min_id, only_media, remote, since_id } =
            extraData.parsedRequest;

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
                        only_media
                            ? sql`EXISTS (SELECT 1 FROM "Attachment" WHERE "Attachment"."statusId" = ${status.id})`
                            : undefined,
                    ),
                limit,
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
    },
);
