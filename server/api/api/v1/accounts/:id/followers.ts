import { applyConfig, auth, handleZodError, idValidator } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { RolePermissions, Users } from "~/drizzle/schema";
import { Timeline } from "~/packages/database-interface/timeline";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 60,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/followers",
    auth: {
        required: false,
        oauthPermissions: ["read:accounts"],
    },
    permissions: {
        required: [
            RolePermissions.VIEW_ACCOUNT_FOLLOWS,
            RolePermissions.VIEW_ACCOUNTS,
        ],
    },
});

export const schemas = {
    query: z.object({
        max_id: z.string().regex(idValidator).optional(),
        since_id: z.string().regex(idValidator).optional(),
        min_id: z.string().regex(idValidator).optional(),
        limit: z.coerce.number().int().min(1).max(40).optional().default(20),
    }),
    param: z.object({
        id: z.string().uuid(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { max_id, since_id, min_id, limit } =
                context.req.valid("query");

            const otherUser = await User.fromId(id);

            // TODO: Add follower/following privacy settings

            if (!otherUser) return errorResponse("User not found", 404);

            const { objects, link } = await Timeline.getUserTimeline(
                and(
                    max_id ? lt(Users.id, max_id) : undefined,
                    since_id ? gte(Users.id, since_id) : undefined,
                    min_id ? gt(Users.id, min_id) : undefined,
                    sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${otherUser.id} AND "Relationships"."ownerId" = ${Users.id} AND "Relationships"."following" = true)`,
                ),
                limit,
                context.req.url,
            );

            return jsonResponse(
                await Promise.all(objects.map((object) => object.toAPI())),
                200,
                {
                    Link: link,
                },
            );
        },
    );
