import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Note as NoteSchema } from "@versia/federation/schemas";
import { Note } from "@versia/kit/db";
import { Notes } from "@versia/kit/tables";
import { and, eq, inArray } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { Status as StatusSchema } from "~/classes/schemas/status";
import { config } from "~/config.ts";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "get",
    path: "/notes/{id}",
    summary: "Retrieve the Versia representation of a note.",
    request: {
        params: z.object({
            id: StatusSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "Note",
            content: {
                "application/json": {
                    schema: NoteSchema,
                },
            },
        },
        404: {
            description:
                "Entity not found, is remote, or the requester is not allowed to view it.",
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

        const note = await Note.fromSql(
            and(
                eq(Notes.id, id),
                inArray(Notes.visibility, ["public", "unlisted"]),
            ),
        );

        if (!(note && (await note.isViewableByUser(null))) || note.isRemote()) {
            throw new ApiError(404, "Note not found");
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
            note.toVersia(),
            reqUrl,
            "GET",
        );

        return context.json(note.toVersia(), 200, headers.toJSON());
    }),
);
