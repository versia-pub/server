import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Status as StatusSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { ApiError } from "~/classes/errors/api-error";

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
                RolePermission.ManageOwnLikes,
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
            description: "Status favourited or was already favourited",
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

        await user.like(note);

        await note.reload(user.id);

        return context.json(await note.toApi(user), 200);
    }),
);
