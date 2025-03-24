import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Status as StatusSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/unfavourite",
    summary: "Undo favourite of a status",
    description: "Remove a status from your favourites list.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#unfavourite",
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
            description: "Status unfavourited or was already not favourited",
            content: {
                "application/json": {
                    schema: StatusSchema,
                },
            },
        },
        404: ApiError.noteNotFound().schema,
        401: ApiError.missingAuthentication().schema,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        const note = context.get("note");

        await user.unlike(note);

        await note.reload(user.id);

        return context.json(await note.toApi(user), 200);
    }),
);
