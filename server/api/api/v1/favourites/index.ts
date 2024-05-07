import { applyConfig, auth, handleZodError, idValidator } from "@api";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, jsonResponse } from "@response";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { Notes } from "~drizzle/schema";
import { Timeline } from "~packages/database-interface/timeline";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/favourites",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
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
        auth(meta.auth),
        async (context) => {
            const { max_id, since_id, min_id, limit } =
                context.req.valid("query");

            const { user } = context.req.valid("header");

            if (!user) return errorResponse("Unauthorized", 401);

            const { objects: favourites, link } =
                await Timeline.getNoteTimeline(
                    and(
                        max_id ? lt(Notes.id, max_id) : undefined,
                        since_id ? gte(Notes.id, since_id) : undefined,
                        min_id ? gt(Notes.id, min_id) : undefined,
                        sql`EXISTS (SELECT 1 FROM "Likes" WHERE "Likes"."likedId" = ${Notes.id} AND "Likes"."likerId" = ${user.id})`,
                    ),
                    limit,
                    context.req.url,
                );

            return jsonResponse(
                await Promise.all(
                    favourites.map(async (note) => note.toAPI(user)),
                ),
                200,
                {
                    Link: link,
                },
            );
        },
    );
