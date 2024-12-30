import { apiRoute, applyConfig, auth, idValidator } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note, Timeline, User } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, eq, gt, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/statuses",
    auth: {
        required: false,
        oauthPermissions: ["read:statuses"],
    },
    permissions: {
        required: [RolePermissions.ViewNotes, RolePermissions.ViewAccounts],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    query: z.object({
        max_id: z.string().regex(idValidator).optional(),
        since_id: z.string().regex(idValidator).optional(),
        min_id: z.string().regex(idValidator).optional(),
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
        404: {
            description: "User not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");

        const otherUser = await User.fromId(id);

        if (!otherUser) {
            throw new ApiError(404, "User not found");
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
        } = context.req.valid("query");

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
