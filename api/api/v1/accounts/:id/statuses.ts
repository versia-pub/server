import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note, Timeline } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, eq, gt, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    query: z.object({
        max_id: z.string().uuid().optional(),
        since_id: z.string().uuid().optional(),
        min_id: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(40).optional().default(20),
        only_media: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        exclude_replies: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        exclude_reblogs: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        pinned: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        tagged: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}/statuses",
    summary: "Get account statuses",
    description: "Gets an paginated list of statuses by the specified account",
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
        params: schemas.param,
        query: schemas.query,
    },
    responses: {
        200: {
            description: "A list of statuses by the specified account",
            content: {
                "application/json": {
                    schema: z.array(Note.schema),
                },
            },
            headers: {
                Link: {
                    description: "Links to the next and previous pages",
                },
            },
        },
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

        const { objects, link } = await Timeline.getNoteTimeline(
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
            context.req.url,
            user?.id,
        );

        return context.json(
            await Promise.all(objects.map((note) => note.toApi(otherUser))),
            200,
            {
                link,
            },
        );
    }),
);
