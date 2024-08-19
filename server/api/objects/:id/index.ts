import { apiRoute, applyConfig, handleZodError } from "@/api";
import { response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import type { Entity } from "@lysand-org/federation/types";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { type LikeType, likeToVersia } from "~/classes/functions/like";
import { db } from "~/drizzle/db";
import { Notes } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Note } from "~/packages/database-interface/note";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/objects/:id",
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        async (context) => {
            const { id } = context.req.valid("param");

            let foundObject: Note | LikeType | null = null;
            let foundAuthor: User | null = null;
            let apiObject: Entity | null = null;

            foundObject = await Note.fromSql(
                and(
                    eq(Notes.id, id),
                    inArray(Notes.visibility, ["public", "unlisted"]),
                ),
            );
            apiObject = foundObject ? foundObject.toVersia() : null;
            foundAuthor = foundObject ? foundObject.author : null;

            if (foundObject) {
                if (!foundObject.isViewableByUser(null)) {
                    return context.json({ error: "Object not found" }, 404);
                }
            } else {
                foundObject =
                    (await db.query.Likes.findFirst({
                        where: (like, { eq, and }) =>
                            and(
                                eq(like.id, id),
                                sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."id" = ${like.likedId} AND "Notes"."visibility" IN ('public', 'unlisted'))`,
                            ),
                    })) ?? null;
                apiObject = foundObject ? likeToVersia(foundObject) : null;
                foundAuthor = foundObject
                    ? await User.fromId(foundObject.likerId)
                    : null;
            }

            if (!(foundObject && apiObject)) {
                return context.json({ error: "Object not found" }, 404);
            }

            if (foundAuthor?.isRemote()) {
                return context.json(
                    { error: "Cannot view objects from remote instances" },
                    403,
                );
            }

            const objectString = JSON.stringify(apiObject);

            // If base_url uses https and request uses http, rewrite request to use https
            // This fixes reverse proxy errors
            const reqUrl = new URL(context.req.url);
            if (
                new URL(config.http.base_url).protocol === "https:" &&
                reqUrl.protocol === "http:"
            ) {
                reqUrl.protocol = "https:";
            }

            const author = foundAuthor ?? User.getServerActor();

            const { headers } = await author.sign(apiObject, reqUrl, "GET");

            return response(objectString, 200, {
                "Content-Type": "application/json",
                ...headers.toJSON(),
            });
        },
    ),
);
