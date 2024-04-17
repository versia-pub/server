import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, eq, gt, gte, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { Notes } from "~drizzle/schema";
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
                    max_id ? lt(Notes.id, max_id) : undefined,
                    since_id ? gte(Notes.id, since_id) : undefined,
                    min_id ? gt(Notes.id, min_id) : undefined,
                ),
                or(
                    eq(Notes.authorId, user.id),
                    sql`EXISTS (SELECT 1 FROM "NoteToMentions" WHERE "NoteToMentions"."noteId" = ${Notes.id} AND "NoteToMentions"."userId" = ${user.id})`,
                    // All statuses from users that the user is following
                    // WHERE format (... = ...)
                    sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Notes.authorId} AND "Relationships"."ownerId" = ${user.id} AND "Relationships"."following" = true)`,
                ),
                // Don't show statuses that have filtered words in them
                // Filters in `Filters` table have keyword in `FilterKeywords` table (use LIKE)
                // Filters table has a userId and a context which is an array
                sql`NOT EXISTS (SELECT 1 FROM "Filters" WHERE "Filters"."userId" = ${user.id} AND "Filters"."filter_action" = 'hide' AND EXISTS (SELECT 1 FROM "FilterKeywords" WHERE "FilterKeywords"."filterId" = "Filters"."id" AND "Notes"."content" LIKE '%' || "FilterKeywords"."keyword" || '%') AND "Filters"."context" @> ARRAY['home'])`,
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
