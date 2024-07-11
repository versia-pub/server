import { applyConfig, auth, handleZodError, idValidator } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { RolePermissions, Users } from "~/drizzle/schema";
import { Timeline } from "~/packages/database-interface/timeline";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/blocks",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:blocks"],
    },
    permissions: {
        required: [RolePermissions.ManageOwnBlocks],
    },
});

export const schemas = {
    query: z.object({
        max_id: z.string().regex(idValidator).optional(),
        since_id: z.string().regex(idValidator).optional(),
        min_id: z.string().regex(idValidator).optional(),
        limit: z.coerce.number().int().min(1).max(80).default(40),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { max_id, since_id, min_id, limit } =
                context.req.valid("query");

            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const { objects: blocks, link } = await Timeline.getUserTimeline(
                and(
                    max_id ? lt(Users.id, max_id) : undefined,
                    since_id ? gte(Users.id, since_id) : undefined,
                    min_id ? gt(Users.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Users.id} AND "Relationships"."ownerId" = ${user.id} AND "Relationships"."blocking" = true)`,
                ),
                limit,
                context.req.url,
            );

            return jsonResponse(
                blocks.map((u) => u.toApi()),
                200,
                {
                    Link: link,
                },
            );
        },
    );
