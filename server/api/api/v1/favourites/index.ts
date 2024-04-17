import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { status } from "~drizzle/schema";
import { Timeline } from "~packages/database-interface/timeline";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/favourites",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
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

        const { limit, max_id, min_id, since_id } = extraData.parsedRequest;

        if (!user) return errorResponse("Unauthorized", 401);

        const { objects, link } = await Timeline.getNoteTimeline(
            and(
                max_id ? lt(status.id, max_id) : undefined,
                since_id ? gte(status.id, since_id) : undefined,
                min_id ? gt(status.id, min_id) : undefined,
                sql`EXISTS (SELECT 1 FROM "Like" WHERE "Like"."likedId" = ${status.id} AND "Like"."likerId" = ${user.id})`,
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
