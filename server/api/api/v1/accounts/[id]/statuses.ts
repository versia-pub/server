import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { findFirstUser } from "~database/entities/User";
import { status } from "~drizzle/schema";
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

        // TODO: Add pinned
        const {
            max_id,
            min_id,
            since_id,
            limit,
            exclude_reblogs,
            only_media,
            pinned,
        } = extraData.parsedRequest;

        const user = await findFirstUser({
            where: (user, { eq }) => eq(user.id, id),
        });

        if (!user) return errorResponse("User not found", 404);

        if (pinned) {
            const { objects, link } = await Timeline.getNoteTimeline(
                and(
                    max_id ? lt(status.id, max_id) : undefined,
                    since_id ? gte(status.id, since_id) : undefined,
                    min_id ? gt(status.id, min_id) : undefined,
                    eq(status.authorId, id),
                    sql`EXISTS (SELECT 1 FROM "UserToPinnedNotes" WHERE "UserToPinnedNotes"."statusId" = ${status.id} AND "UserToPinnedNotes"."userId" = ${user.id})`,
                    only_media
                        ? sql`EXISTS (SELECT 1 FROM "Attachment" WHERE "Attachment"."statusId" = ${status.id})`
                        : undefined,
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
        }

        const { objects, link } = await Timeline.getNoteTimeline(
            and(
                max_id ? lt(status.id, max_id) : undefined,
                since_id ? gte(status.id, since_id) : undefined,
                min_id ? gt(status.id, min_id) : undefined,
                eq(status.authorId, id),
                only_media
                    ? sql`EXISTS (SELECT 1 FROM "Attachment" WHERE "Attachment"."statusId" = ${status.id})`
                    : undefined,
                exclude_reblogs ? isNull(status.reblogId) : undefined,
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
