import { Status as StatusSchema } from "@versia/client/schemas";
import { Like, User } from "@versia/kit/db";
import { Likes } from "@versia/kit/tables";
import { and, eq, sql } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { apiRoute, handleZodError } from "@/api";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";
import { LikeSchema } from "~/packages/sdk/schemas";

export default apiRoute((app) =>
    app.get(
        "/likes/:id",
        describeRoute({
            summary: "Retrieve the Versia representation of a like.",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Like",
                    content: {
                        "application/json": {
                            schema: resolver(LikeSchema),
                        },
                    },
                },
                404: {
                    description:
                        "Entity not found, is remote, or the requester is not allowed to view it.",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
            },
        }),
        validator(
            "param",
            z.object({ id: StatusSchema.shape.id }),
            handleZodError,
        ),
        async (context) => {
            const { id } = context.req.valid("param");

            // Don't fetch a like of a note that is not public or unlisted
            // prevents leaking the existence of a private note
            const like = await Like.fromSql(
                and(
                    eq(Likes.id, id),
                    sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."id" = ${Likes.likedId} AND "Notes"."visibility" IN ('public', 'unlisted'))`,
                ),
            );

            if (!like) {
                throw ApiError.likeNotFound();
            }

            const liker = await User.fromId(like.data.likerId);

            if (!liker || liker.remote) {
                throw ApiError.accountNotFound();
            }

            // If base_url uses https and request uses http, rewrite request to use https
            // This fixes reverse proxy errors
            const reqUrl = new URL(context.req.url);
            if (
                config.http.base_url.protocol === "https:" &&
                reqUrl.protocol === "http:"
            ) {
                reqUrl.protocol = "https:";
            }

            const { headers } = await liker.sign(
                like.toVersia(),
                reqUrl,
                "GET",
            );

            return context.json(like.toVersia(), 200, headers.toJSON());
        },
    ),
);
