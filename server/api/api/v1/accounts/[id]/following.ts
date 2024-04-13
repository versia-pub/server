import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
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
    route: "/api/v1/accounts/:id/following",
    auth: {
        required: false,
        oauthPermissions: [],
    },
});

/**
 * Fetch all statuses for a user
 */
export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    // TODO: Add pinned
    const { max_id, min_id, since_id, limit = 20 } = extraData.parsedRequest;

    const otherUser = await findFirstUser({
        where: (user, { eq }) => eq(user.id, id),
    });

    if (limit < 1 || limit > 40) return errorResponse("Invalid limit", 400);

    if (!otherUser) return errorResponse("User not found", 404);

    const { objects, link } = await fetchTimeline<UserWithRelations>(
        findManyUsers,
        {
            // @ts-ignore
            where: (following, { and, lt, gt, gte, eq, sql }) =>
                and(
                    max_id ? lt(following.id, max_id) : undefined,
                    since_id ? gte(following.id, since_id) : undefined,
                    min_id ? gt(following.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Relationship" WHERE "Relationship"."subjectId" = ${following.id} AND "Relationship"."objectId" = ${otherUser.id} AND "Relationship"."following" = true)`,
                ),
            // @ts-expect-error Yes I KNOW the types are wrong
            orderBy: (liker, { desc }) => desc(liker.id),
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
});
