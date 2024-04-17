import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { z } from "zod";
import {
    type UserWithRelations,
    findFirstUser,
    findManyUsers,
    userToAPI,
} from "~database/entities/User";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 60,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/followers",
    auth: {
        required: false,
        oauthPermissions: [],
    },
});

const schema = z.object({
    max_id: z.string().regex(idValidator).optional(),
    since_id: z.string().regex(idValidator).optional(),
    min_id: z.string().regex(idValidator).optional(),
    limit: z.coerce.number().int().min(1).max(40).optional().default(20),
});

/**
 * Fetch all statuses for a user
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const id = matchedRoute.params.id;
        if (!id.match(idValidator)) {
            return errorResponse("Invalid ID, must be of type UUIDv7", 404);
        }

        // TODO: Add pinned
        const { max_id, min_id, since_id, limit } = extraData.parsedRequest;

        const otherUser = await findFirstUser({
            where: (user, { eq }) => eq(user.id, id),
        });

        if (!otherUser) return errorResponse("User not found", 404);

        const { objects, link } = await fetchTimeline<UserWithRelations>(
            findManyUsers,
            {
                // @ts-ignore
                where: (follower, { and, lt, gt, gte, eq, sql }) =>
                    and(
                        max_id ? lt(follower.id, max_id) : undefined,
                        since_id ? gte(follower.id, since_id) : undefined,
                        min_id ? gt(follower.id, min_id) : undefined,
                        sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${otherUser.id} AND "Relationships"."ownerId" = ${follower.id} AND "Relationships"."following" = true)`,
                    ),
                // @ts-expect-error Yes I KNOW the types are wrong
                orderBy: (liker, { desc }) => desc(liker.id),
                limit,
            },
            req,
        );

        return jsonResponse(
            await Promise.all(objects.map((object) => userToAPI(object))),
            200,
            {
                Link: link,
            },
        );
    },
);
