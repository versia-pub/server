import { Status as StatusSchema } from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { apiRoute, handleZodError } from "@versia/kit/api";
import { Note } from "@versia/kit/db";
import { Notes } from "@versia/kit/tables";
import { ShareSchema } from "@versia/sdk/schemas";
import { config } from "@versia-server/config";
import { and, eq, inArray } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";

export default apiRoute((app) =>
    app.get(
        "/shares/:id",
        describeRoute({
            summary: "Retrieve the Versia representation of a share.",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Share",
                    content: {
                        "application/json": {
                            schema: resolver(ShareSchema),
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
            z.object({
                id: StatusSchema.shape.id,
            }),
            handleZodError,
        ),
        async (context) => {
            const { id } = context.req.valid("param");

            const note = await Note.fromSql(
                and(
                    eq(Notes.id, id),
                    inArray(Notes.visibility, ["public", "unlisted"]),
                ),
            );

            if (!(note && (await note.isViewableByUser(null))) || note.remote) {
                throw ApiError.noteNotFound();
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

            const { headers } = await note.author.sign(
                note.toVersiaShare(),
                reqUrl,
                "GET",
            );

            return context.json(note.toVersiaShare(), 200, headers.toJSON());
        },
    ),
);
