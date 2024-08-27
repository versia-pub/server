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
import { RolePermissions, Users } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";
import { Timeline } from "~/packages/database-interface/timeline";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/favourited_by",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ViewNotes, RolePermissions.ViewNoteLikes],
    },
});

export const schemas = {
    query: z.object({
        max_id: z.string().regex(idValidator).optional(),
        since_id: z.string().regex(idValidator).optional(),
        min_id: z.string().regex(idValidator).optional(),
        limit: z.coerce.number().int().min(1).max(80).default(40),
    }),
    param: z.object({
        id: z.string().uuid(),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { max_id, since_id, min_id, limit } =
                context.req.valid("query");
            const { id } = context.req.valid("param");

            const { user } = context.req.valid("header");

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const status = await Note.fromId(id, user?.id);

            if (!status?.isViewableByUser(user)) {
                return context.json({ error: "Record not found" }, 404);
            }

            const { objects, link } = await Timeline.getUserTimeline(
                and(
                    max_id ? lt(Users.id, max_id) : undefined,
                    since_id ? gte(Users.id, since_id) : undefined,
                    min_id ? gt(Users.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Likes" WHERE "Likes"."likedId" = ${status.id} AND "Likes"."likerId" = ${Users.id})`,
                ),
                limit,
                context.req.url,
            );

            return context.json(
                objects.map((user) => user.toApi()),
                200,
                {
                    Link: link,
                },
            );
        },
    ),
);
