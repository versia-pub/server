import {
    accountNotFound,
    apiRoute,
    auth,
    reusedResponses,
    withUserParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Timeline } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, eq, gt, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { Account as AccountSchema } from "~/classes/schemas/account";
import { zBoolean } from "~/classes/schemas/common.ts";
import { Status as StatusSchema } from "~/classes/schemas/status";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}/statuses",
    summary: "Get account’s statuses",
    description: "Statuses posted to the given account.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#statuses",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: false,
            permissions: [
                RolePermissions.ViewNotes,
                RolePermissions.ViewAccounts,
            ],
            scopes: ["read:statuses"],
        }),
        withUserParam,
    ] as const,
    request: {
        params: z.object({
            id: AccountSchema.shape.id,
        }),
        query: z.object({
            max_id: StatusSchema.shape.id.optional().openapi({
                description:
                    "All results returned will be lesser than this ID. In effect, sets an upper bound on results.",
                example: "8d35243d-b959-43e2-8bac-1a9d4eaea2aa",
            }),
            since_id: StatusSchema.shape.id.optional().openapi({
                description:
                    "All results returned will be greater than this ID. In effect, sets a lower bound on results.",
                example: undefined,
            }),
            min_id: StatusSchema.shape.id.optional().openapi({
                description:
                    "Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.",
                example: undefined,
            }),
            limit: z.coerce.number().int().min(1).max(40).default(20).openapi({
                description: "Maximum number of results to return.",
            }),
            only_media: zBoolean.default(false).openapi({
                description: "Filter out statuses without attachments.",
            }),
            exclude_replies: zBoolean.default(false).openapi({
                description:
                    "Filter out statuses in reply to a different account.",
            }),
            exclude_reblogs: zBoolean.default(false).openapi({
                description: "Filter out boosts from the response.",
            }),
            pinned: zBoolean.default(false).openapi({
                description:
                    "Filter for pinned statuses only. Pinned statuses do not receive special priority in the order of the returned results.",
            }),
            tagged: z.string().optional().openapi({
                description: "Filter for statuses using a specific hashtag.",
            }),
        }),
    },
    responses: {
        200: {
            description: "Statuses posted to the given account.",
            content: {
                "application/json": {
                    schema: z.array(StatusSchema),
                },
            },
        },
        404: accountNotFound,
        422: reusedResponses[422],
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        const otherUser = context.get("user");

        const {
            max_id,
            min_id,
            since_id,
            limit,
            exclude_reblogs,
            only_media,
            exclude_replies,
            pinned,
        } = context.req.valid("query");

        const { objects } = await Timeline.getNoteTimeline(
            and(
                max_id ? lt(Notes.id, max_id) : undefined,
                since_id ? gte(Notes.id, since_id) : undefined,
                min_id ? gt(Notes.id, min_id) : undefined,
                eq(Notes.authorId, otherUser.id),
                only_media
                    ? sql`EXISTS (SELECT 1 FROM "Medias" WHERE "Medias"."noteId" = ${Notes.id})`
                    : undefined,
                pinned
                    ? sql`EXISTS (SELECT 1 FROM "UserToPinnedNotes" WHERE "UserToPinnedNotes"."noteId" = ${Notes.id} AND "UserToPinnedNotes"."userId" = ${otherUser.id})`
                    : undefined,
                // Visibility check
                or(
                    sql`EXISTS (SELECT 1 FROM "NoteToMentions" WHERE "NoteToMentions"."noteId" = ${Notes.id} AND "NoteToMentions"."userId" = ${otherUser.id})`,
                    and(
                        sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Notes.authorId} AND "Relationships"."ownerId" = ${otherUser.id} AND "Relationships"."following" = true)`,
                        inArray(Notes.visibility, ["public", "private"]),
                    ),
                    inArray(Notes.visibility, ["public", "unlisted"]),
                ),
                exclude_reblogs ? isNull(Notes.reblogId) : undefined,
                exclude_replies ? isNull(Notes.replyId) : undefined,
            ),
            limit,
            new URL(context.req.url),
            user?.id,
        );

        return context.json(
            await Promise.all(objects.map((note) => note.toApi(otherUser))),
            200,
        );
    }),
);
