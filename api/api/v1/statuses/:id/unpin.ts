import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Status as StatusSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/unpin",
    summary: "Unpin status from profile",
    description: "Unfeature a status from the top of your profile.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#unpin",
    },
    tags: ["Statuses"],
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnNotes,
                RolePermission.ViewNotes,
            ],
        }),
        withNoteParam,
    ] as const,
    request: {
        params: z.object({
            id: StatusSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "Status unpinned, or was already not pinned",
            content: {
                "application/json": {
                    schema: StatusSchema,
                },
            },
        },
        404: ApiError.noteNotFound().schema,
        403: ApiError.forbidden().schema,
        401: ApiError.missingAuthentication().schema,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        const note = context.get("note");

        if (note.author.id !== user.id) {
            throw ApiError.forbidden();
        }

        await user.unpin(note);

        if (!note) {
            throw ApiError.noteNotFound();
        }

        return context.json(await note.toApi(user), 200);
    }),
);
