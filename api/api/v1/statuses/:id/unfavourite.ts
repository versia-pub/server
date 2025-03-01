import {
    apiRoute,
    auth,
    noteNotFound,
    reusedResponses,
    withNoteParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { RolePermissions } from "@versia/kit/tables";
import { Status as StatusSchema } from "~/classes/schemas/status";

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
            description: "Status unfavourited or was already not favourited",
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

        await user.unlike(note);

        await note.reload(user.id);

        return context.json(await note.toApi(user), 200);
    }),
);
