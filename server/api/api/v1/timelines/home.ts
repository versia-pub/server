import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, eq, gt, gte, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { status } from "~drizzle/schema";
import { Timeline } from "~packages/database-interface/timeline";

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

export const schema = z.object({
    max_id: z.string().regex(idValidator).optional(),
    since_id: z.string().regex(idValidator).optional(),
    min_id: z.string().regex(idValidator).optional(),
    limit: z.coerce.number().int().min(1).max(80).optional().default(20),
});

/**
 * Fetch home timeline statuses
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { user } = extraData.auth;

        const { limit, max_id, min_id, since_id } = extraData.parsedRequest;

        if (!user) return errorResponse("Unauthorized", 401);

        const { objects, link } = await Timeline.getNoteTimeline(
            and(
                and(
                    max_id ? lt(status.id, max_id) : undefined,
                    since_id ? gte(status.id, since_id) : undefined,
                    min_id ? gt(status.id, min_id) : undefined,
                ),
                or(
                    eq(status.authorId, user.id),
                    // All statuses where the user is mentioned, using table _StatusToUser which has a: status.id and b: user.id
                    // WHERE format (... = ...)
                    sql`EXISTS (SELECT 1 FROM "StatusToMentions" WHERE "StatusToMentions"."statusId" = ${status.id} AND "StatusToMentions"."userId" = ${user.id})`,
                    // All statuses from users that the user is following
                    // WHERE format (... = ...)
                    sql`EXISTS (SELECT 1 FROM "Relationship" WHERE "Relationship"."subjectId" = ${status.authorId} AND "Relationship"."ownerId" = ${user.id} AND "Relationship"."following" = true)`,
                ),
            ),
            limit,
            req.url,
        );

        return jsonResponse(
            await Promise.all(objects.map(async (note) => note.toAPI(user))),
            200,
            {
                Link: link,
            },
        );
    },
);
