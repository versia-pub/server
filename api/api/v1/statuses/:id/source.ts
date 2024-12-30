import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import type { StatusSource as ApiStatusSource } from "@versia/client/types";
import { Note } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "get",
    path: "/api/v1/statuses/{id}/source",
    summary: "Get status source",
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnNotes,
                RolePermissions.ViewNotes,
            ],
        }),
    ] as const,
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
    },
    responses: {
        200: {
            description: "Status source",
            content: {
                "application/json": {
                    schema: z.object({
                        id: z.string().uuid(),
                        spoiler_text: z.string(),
                        text: z.string(),
                    }),
                },
            },
        },

        404: {
            description: "Record not found",
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
        const { user } = context.get("auth");

        const note = await Note.fromId(id, user.id);

        if (!(note && (await note?.isViewableByUser(user)))) {
            throw new ApiError(404, "Note not found");
        }

        return context.json(
            {
                id: note.id,
                // TODO: Give real source for spoilerText
                spoiler_text: note.data.spoilerText,
                text: note.data.contentSource,
            } satisfies ApiStatusSource,
            200,
        );
    }),
);
