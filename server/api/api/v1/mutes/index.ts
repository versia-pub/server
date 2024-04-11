import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { client } from "~database/datasource";
import {
    findManyUsers,
    userToAPI,
    type UserWithRelations,
} from "~database/entities/User";
import { userRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/mutes",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:mutes"],
    },
});

export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;
    const { max_id, since_id, limit = 40, min_id } = extraData.parsedRequest;

    if (!user) return errorResponse("Unauthorized", 401);

    const { objects: blocks, link } = await fetchTimeline<UserWithRelations>(
        findManyUsers,
        {
            // @ts-expect-error Yes I KNOW the types are wrong
            where: (subject, { lt, gte, gt, and, sql }) =>
                and(
                    max_id ? lt(subject.id, max_id) : undefined,
                    since_id ? gte(subject.id, since_id) : undefined,
                    min_id ? gt(subject.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Relationship" WHERE "Relationship"."subjectId" = ${subject.id} AND "Relationship"."ownerId" = ${user.id} AND "Relationship"."muting" = true)`,
                ),
            limit: Number(limit),
            // @ts-expect-error Yes I KNOW the types are wrong
            orderBy: (subject, { desc }) => desc(subject.id),
        },
        req,
    );

    return jsonResponse(blocks.map((u) => userToAPI(u)));
});
