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
    path: "/api/v1/statuses/{id}/favourite",
    summary: "Favourite a status",
    description: "Add a status to your favourites list.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#favourite",
    },
    tags: ["Statuses"],
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnLikes,
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
            description: "Status favourited or was already favourited",
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

        await user.like(note);

        await note.reload(user.id);

        return context.json(await note.toApi(user), 200);
    }),
);
