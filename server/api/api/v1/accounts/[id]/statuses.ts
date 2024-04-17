import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { findFirstUser } from "~database/entities/User";
import { Notes } from "~drizzle/schema";
import { Timeline } from "~packages/database-interface/timeline";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/statuses",
    auth: {
        required: false,
        oauthPermissions: ["read:statuses"],
    },
});

export const schema = z.object({
    max_id: z.string().regex(idValidator).optional(),
    since_id: z.string().regex(idValidator).optional(),
    min_id: z.string().regex(idValidator).optional(),
    limit: z.coerce.number().int().min(1).max(40).optional().default(20),
    only_media: z.coerce.boolean().optional(),
    exclude_replies: z.coerce.boolean().optional(),
    exclude_reblogs: z.coerce.boolean().optional(),
    pinned: z.coerce.boolean().optional(),
    tagged: z.string().optional(),
});

/**
 * Fetch all statuses for a user
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const id = matchedRoute.params.id;
        if (!id.match(idValidator)) {
            return errorResponse("Invalid ID, must be of type UUIDv7", 404);
        }

        const {
            max_id,
            min_id,
            since_id,
            limit,
            exclude_reblogs,
            only_media,
            exclude_replies,
            pinned,
        } = extraData.parsedRequest;

        const user = await findFirstUser({
            where: (user, { eq }) => eq(user.id, id),
        });

        if (!user) return errorResponse("User not found", 404);

        const { objects, link } = await Timeline.getNoteTimeline(
            and(
                max_id ? lt(Notes.id, max_id) : undefined,
                since_id ? gte(Notes.id, since_id) : undefined,
                min_id ? gt(Notes.id, min_id) : undefined,
                eq(Notes.authorId, id),
                only_media
                    ? sql`EXISTS (SELECT 1 FROM "Attachments" WHERE "Attachments"."noteId" = ${Notes.id})`
                    : undefined,
                pinned
                    ? sql`EXISTS (SELECT 1 FROM "UserToPinnedNotes" WHERE "UserToPinnedNotes"."noteId" = ${Notes.id} AND "UserToPinnedNotes"."userId" = ${user.id})`
                    : undefined,
                exclude_reblogs ? isNull(Notes.reblogId) : undefined,
                exclude_replies ? isNull(Notes.replyId) : undefined,
            ),
            limit,
            req.url,
        );

        return jsonResponse(
            await Promise.all(objects.map((note) => note.toAPI(user))),
            200,
            {
                Link: link,
            },
        );
    },
);
