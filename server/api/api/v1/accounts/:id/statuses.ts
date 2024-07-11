import { applyConfig, auth, handleZodError, idValidator } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { Notes, RolePermissions } from "~/drizzle/schema";
import { Timeline } from "~/packages/database-interface/timeline";
import { User } from "~/packages/database-interface/user";

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

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.req.valid("header");

            const otherUser = await User.fromId(id);

            if (!otherUser) {
                return errorResponse("User not found", 404);
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
                    exclude_reblogs ? isNull(Notes.reblogId) : undefined,
                    exclude_replies ? isNull(Notes.replyId) : undefined,
                ),
                limit,
                context.req.url,
                user?.id,
            );

            return jsonResponse(
                await Promise.all(objects.map((note) => note.toApi(otherUser))),
                200,
                {
                    link,
                },
            );
        },
    );
