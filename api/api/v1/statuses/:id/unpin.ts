import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
import { Status } from "~/classes/schemas/status";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/unpin",
    summary: "Unpin a status",
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnNotes,
                RolePermissions.ViewNotes,
            ],
        }),
        withNoteParam,
    ] as const,
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
    },
    responses: {
        200: {
            description: "Unpinned status",
            content: {
                "application/json": {
                    schema: Status,
                },
            },
        },
        401: {
            description: "Unauthorized",
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
        const { user } = context.get("auth");
        const note = context.get("note");

        if (note.author.id !== user.id) {
            throw new ApiError(401, "Unauthorized");
        }

        await user.unpin(note);

        if (!note) {
            throw new ApiError(404, "Note not found");
        }

        return context.json(await note.toApi(user), 200);
    }),
);
