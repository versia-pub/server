import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { fetchTimeline } from "@timelines";
import {
    type StatusWithRelations,
    findManyStatuses,
    statusToAPI,
} from "~database/entities/Status";
import { findFirstUser } from "~database/entities/User";

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

/**
 * Fetch all statuses for a user
 */
export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: string;
    only_media?: boolean;
    exclude_replies?: boolean;
    exclude_reblogs?: boolean;
    // TODO: Add with_muted
    pinned?: boolean;
    tagged?: string;
}>(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;

    // TODO: Add pinned
    const {
        max_id,
        min_id,
        since_id,
        limit = "20",
        exclude_reblogs,
        only_media = false,
        pinned,
    } = extraData.parsedRequest;

    const user = await findFirstUser({
        where: (user, { eq }) => eq(user.id, id),
    });

    if (!user) return errorResponse("User not found", 404);

    if (pinned) {
        const { objects, link } = await fetchTimeline<StatusWithRelations>(
            findManyStatuses,
            {
                // @ts-ignore
                where: (status, { and, lt, gt, gte, eq, sql }) =>
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
                // @ts-expect-error Yes I KNOW the types are wrong
                orderBy: (status, { desc }) => desc(status.id),
            },
            req,
        );

        return jsonResponse(
            await Promise.all(
                objects.map((status) => statusToAPI(status, user)),
            ),
            200,
            {
                Link: link,
            },
        );
    }

    const { objects, link } = await fetchTimeline<StatusWithRelations>(
        findManyStatuses,
        {
            // @ts-ignore
            where: (status, { and, lt, gt, gte, eq, sql }) =>
                and(
                    max_id ? lt(status.id, max_id) : undefined,
                    since_id ? gte(status.id, since_id) : undefined,
                    min_id ? gt(status.id, min_id) : undefined,
                    eq(status.authorId, id),
                    only_media
                        ? sql`EXISTS (SELECT 1 FROM "Attachment" WHERE "Attachment"."statusId" = ${status.id})`
                        : undefined,
                    exclude_reblogs ? eq(status.reblogId, null) : undefined,
                ),
            // @ts-expect-error Yes I KNOW the types are wrong
            orderBy: (status, { desc }) => desc(status.id),
        },
        req,
    );

    return jsonResponse(
        await Promise.all(objects.map((status) => statusToAPI(status, user))),
        200,
        {
            Link: link,
        },
    );
});
