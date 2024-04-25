import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { Users } from "~drizzle/schema";
import { Note } from "~packages/database-interface/note";
import { Timeline } from "~packages/database-interface/timeline";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/reblogged_by",
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
 * Fetch users who reblogged the post
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const id = matchedRoute.params.id;
        if (!id.match(idValidator)) {
            return errorResponse("Invalid ID, must be of type UUIDv7", 404);
        }

        const { user } = extraData.auth;

        const status = await Note.fromId(id);

        // Check if user is authorized to view this status (if it's private)
        if (!status?.isViewableByUser(user))
            return errorResponse("Record not found", 404);

        const { max_id, min_id, since_id, limit } = extraData.parsedRequest;

        const { objects, link } = await Timeline.getUserTimeline(
            and(
                max_id ? lt(Users.id, max_id) : undefined,
                since_id ? gte(Users.id, since_id) : undefined,
                min_id ? gt(Users.id, min_id) : undefined,
                sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."reblogId" = ${status.id} AND "Notes"."authorId" = ${Users.id})`,
            ),
            limit,
            req.url,
        );

        return jsonResponse(
            objects.map((user) => user.toAPI()),
            200,
            {
                Link: link,
            },
        );
    },
);
