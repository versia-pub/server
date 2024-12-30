import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/unfavourite",
    summary: "Unfavourite a status",
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
            description: "Unfavourited status",
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

        await user.unlike(note);

        await note.reload(user.id);

        return context.json(await note.toApi(user), 200);
    }),
);
