import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import { z } from "zod";
import {
    type UserWithRelations,
    findManyUsers,
    userToAPI,
} from "~database/entities/User";

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

export const schema = z.object({
    max_id: z.string().regex(idValidator).optional(),
    since_id: z.string().regex(idValidator).optional(),
    min_id: z.string().regex(idValidator).optional(),
    limit: z.coerce.number().int().min(1).max(80).default(40),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { user } = extraData.auth;
        const { max_id, since_id, limit, min_id } = extraData.parsedRequest;

        if (!user) return errorResponse("Unauthorized", 401);

        const { objects: blocks, link } =
            await fetchTimeline<UserWithRelations>(
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
                    limit,
                    // @ts-expect-error Yes I KNOW the types are wrong
                    orderBy: (subject, { desc }) => desc(subject.id),
                },
                req,
            );

        return jsonResponse(blocks.map((u) => userToAPI(u)));
    },
);
