import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { Notes } from "~drizzle/schema";
import { Timeline } from "~packages/database-interface/timeline";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 200,
        duration: 60,
    },
    route: "/api/v1/timelines/public",
    auth: {
        required: false,
    },
});

export const schema = z.object({
    max_id: z.string().regex(idValidator).optional(),
    since_id: z.string().regex(idValidator).optional(),
    min_id: z.string().regex(idValidator).optional(),
    limit: z.coerce.number().int().min(1).max(80).optional().default(20),
    local: z.boolean().optional(),
    remote: z.boolean().optional(),
    only_media: z.boolean().optional(),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { user } = extraData.auth;
        const { local, limit, max_id, min_id, only_media, remote, since_id } =
            extraData.parsedRequest;

        if (local && remote) {
            return errorResponse("Cannot use both local and remote", 400);
        }

        const { objects, link } = await Timeline.getNoteTimeline(
            and(
                max_id ? lt(Notes.id, max_id) : undefined,
                since_id ? gte(Notes.id, since_id) : undefined,
                min_id ? gt(Notes.id, min_id) : undefined,
                // use authorId to grab user, then use user.instanceId to filter local/remote statuses
                remote
                    ? sql`EXISTS (SELECT 1 FROM "Users" WHERE "Users"."id" = ${Notes.authorId} AND "Users"."instanceId" IS NOT NULL)`
                    : undefined,
                local
                    ? sql`EXISTS (SELECT 1 FROM "Users" WHERE "Users"."id" = ${Notes.authorId} AND "Users"."instanceId" IS NULL)`
                    : undefined,
                only_media
                    ? sql`EXISTS (SELECT 1 FROM "Attachments" WHERE "Attachments"."noteId" = ${Notes.id})`
                    : undefined,
                user
                    ? sql`NOT EXISTS (SELECT 1 FROM "Filters" WHERE "Filters"."userId" = ${user.id} AND "Filters"."filter_action" = 'hide' AND EXISTS (SELECT 1 FROM "FilterKeywords" WHERE "FilterKeywords"."filterId" = "Filters"."id" AND "Notes"."content" LIKE '%' || "FilterKeywords"."keyword" || '%') AND "Filters"."context" @> ARRAY['public'])`
                    : undefined,
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
