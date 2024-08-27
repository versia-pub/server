import {
    apiRoute,
    applyConfig,
    auth,
    handleZodError,
    idValidator,
} from "@/api";
import { zValidator } from "@hono/zod-validator";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { Notes, RolePermissions } from "~/drizzle/schema";
import { Timeline } from "~/packages/database-interface/timeline";

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
    permissions: {
        required: [
            RolePermissions.ViewNotes,
            RolePermissions.ViewAccounts,
            RolePermissions.ViewPublicTimelines,
        ],
    },
});

export const schemas = {
    query: z.object({
        max_id: z.string().regex(idValidator).optional(),
        since_id: z.string().regex(idValidator).optional(),
        min_id: z.string().regex(idValidator).optional(),
        limit: z.coerce.number().int().min(1).max(80).default(20),
        local: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        remote: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        only_media: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const {
                max_id,
                since_id,
                min_id,
                limit,
                local,
                remote,
                only_media,
            } = context.req.valid("query");

            const { user } = context.req.valid("header");

            const { objects, link } = await Timeline.getNoteTimeline(
                and(
                    max_id ? lt(Notes.id, max_id) : undefined,
                    since_id ? gte(Notes.id, since_id) : undefined,
                    min_id ? gt(Notes.id, min_id) : undefined,
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
                context.req.url,
                user?.id,
            );

            return context.json(
                await Promise.all(
                    objects.map(async (note) => note.toApi(user)),
                ),
                200,
                {
                    Link: link,
                },
            );
        },
    ),
);
