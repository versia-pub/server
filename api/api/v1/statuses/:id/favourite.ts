import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Note } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/favourite",
    summary: "Favourite a status",
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
            id: z.string().uuid(),
        }),
    },
    responses: {
        200: {
            description: "Favourited status",
            content: {
                "application/json": {
                    schema: Note.schema,
                },
            },
        },
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
