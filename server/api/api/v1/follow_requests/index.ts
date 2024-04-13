import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import {
    type UserWithRelations,
    findManyUsers,
    userToAPI,
} from "~database/entities/User";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/follow_requests",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
    },
});

export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;

    const { limit = 20, max_id, min_id, since_id } = extraData.parsedRequest;

    if (limit < 1 || limit > 40) {
        return errorResponse("Limit must be between 1 and 40", 400);
    }

    if (!user) return errorResponse("Unauthorized", 401);

    const { objects, link } = await fetchTimeline<UserWithRelations>(
        findManyUsers,
        {
            // @ts-expect-error Yes I KNOW the types are wrong
            where: (subject, { lt, gte, gt, and, sql }) =>
                and(
                    max_id ? lt(subject.id, max_id) : undefined,
                    since_id ? gte(subject.id, since_id) : undefined,
                    min_id ? gt(subject.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Relationship" WHERE "Relationship"."subjectId" = ${user.id} AND "Relationship"."ownerId" = ${subject.id} AND "Relationship"."requested" = true)`,
                ),
            limit: Number(limit),
            // @ts-expect-error Yes I KNOW the types are wrong
            orderBy: (subject, { desc }) => desc(subject.id),
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
});
