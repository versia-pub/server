import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { z } from "zod";
import { findFirstStatuses, isViewableByUser } from "~database/entities/Status";
import {
    type UserWithRelations,
    findManyUsers,
    userToAPI,
} from "~database/entities/User";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/favourited_by",
    auth: {
        required: true,
    },
});

export const schema = z.object({
    max_id: z.string().regex(idValidator).optional(),
    since_id: z.string().regex(idValidator).optional(),
    min_id: z.string().regex(idValidator).optional(),
    limit: z.coerce.number().int().min(1).max(80).optional().default(40),
});

/**
 * Fetch users who favourited the post
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const id = matchedRoute.params.id;
        if (!id.match(idValidator)) {
            return errorResponse("Invalid ID, must be of type UUIDv7", 404);
        }

        const { user } = extraData.auth;

        const status = await findFirstStatuses({
            where: (status, { eq }) => eq(status.id, id),
        });

        // Check if user is authorized to view this status (if it's private)
        if (!status || !isViewableByUser(status, user))
            return errorResponse("Record not found", 404);

        const { max_id, min_id, since_id, limit } = extraData.parsedRequest;

        const { objects, link } = await fetchTimeline<UserWithRelations>(
            findManyUsers,
            {
                // @ts-ignore
                where: (liker, { and, lt, gt, gte, eq, sql }) =>
                    and(
                        max_id ? lt(liker.id, max_id) : undefined,
                        since_id ? gte(liker.id, since_id) : undefined,
                        min_id ? gt(liker.id, min_id) : undefined,
                        sql`EXISTS (SELECT 1 FROM "Like" WHERE "Like"."likedId" = ${status.id} AND "Like"."likerId" = ${liker.id})`,
                    ),
                // @ts-expect-error Yes I KNOW the types are wrong
                orderBy: (liker, { desc }) => desc(liker.id),
                limit,
            },
            req,
        );

        return jsonResponse(
            objects.map((user) => userToAPI(user)),
            200,
            {
                Link: link,
            },
        );
    },
);
