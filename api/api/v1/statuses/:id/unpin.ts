import {
    apiRoute,
    auth,
    noteNotFound,
    reusedResponses,
    withNoteParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Status as StatusSchema } from "@versia/client-ng/schemas";
import { RolePermissions } from "@versia/kit/tables";
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
                RolePermissions.ManageOwnNotes,
                RolePermissions.ViewNotes,
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
        404: noteNotFound,
        401: reusedResponses[401],
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
