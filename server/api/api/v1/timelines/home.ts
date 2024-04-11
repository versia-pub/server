import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import {
    type StatusWithRelations,
    statusToAPI,
    findManyStatuses,
} from "~database/entities/Status";
import { db } from "~drizzle/db";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 200,
        duration: 60,
    },
    route: "/api/v1/timelines/home",
    auth: {
        required: true,
    },
});

/**
 * Fetch home timeline statuses
 */
export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;

    const { limit = 20, max_id, min_id, since_id } = extraData.parsedRequest;

    if (limit < 1 || limit > 80) {
        return errorResponse("Limit must be between 1 and 40", 400);
    }

    if (!user) return errorResponse("Unauthorized", 401);

    const followers = await db.query.relationship.findMany({
        where: (relationship, { eq, and }) =>
            and(
                eq(relationship.subjectId, user.id),
                eq(relationship.following, true),
            ),
    });

    const { objects, link } = await fetchTimeline<StatusWithRelations>(
        findManyStatuses,
        {
            // @ts-expect-error Yes I KNOW the types are wrong
            where: (status, { lt, gte, gt, and, or, eq, inArray, sql }) =>
                and(
                    and(
                        max_id ? lt(status.id, max_id) : undefined,
                        since_id ? gte(status.id, since_id) : undefined,
                        min_id ? gt(status.id, min_id) : undefined,
                    ),
                    or(
                        eq(status.authorId, user.id),
                        /* inArray(
                        status.authorId,
                        followers.map((f) => f.ownerId),
                    ), */
                        // All statuses where the user is mentioned, using table _StatusToUser which has a: status.id and b: user.id
                        // WHERE format (... = ...)
                        sql`EXISTS (SELECT 1 FROM "_StatusToUser" WHERE "_StatusToUser"."A" = ${status.id} AND "_StatusToUser"."B" = ${user.id})`,
                        // All statuses from users that the user is following
                        // WHERE format (... = ...)
                        sql`EXISTS (SELECT 1 FROM "Relationship" WHERE "Relationship"."subjectId" = ${status.authorId} AND "Relationship"."ownerId" = ${user.id} AND "Relationship"."following" = true)`,
                    ),
                ),
            limit: Number(limit),
            // @ts-expect-error Yes I KNOW the types are wrong
            orderBy: (status, { desc }) => desc(status.id),
        },
        req,
    );

    return jsonResponse(
        await Promise.all(
            objects.map(async (status) => statusToAPI(status, user)),
        ),
        200,
        {
            Link: link,
        },
    );
});
