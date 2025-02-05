import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Note } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, eq } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/unreblog",
    summary: "Unreblog a status",
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
            description: "Unreblogged status",
            content: {
                "application/json": {
                    schema: Note.schema,
                },
            },
        },
        422: {
            description: "Not already reblogged",
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
        const note = context.get("note");

        const existingReblog = await Note.fromSql(
            and(eq(Notes.authorId, user.id), eq(Notes.reblogId, note.data.id)),
            undefined,
            user?.id,
        );

        if (!existingReblog) {
            throw new ApiError(422, "Note already reblogged");
        }

        await existingReblog.delete();

        await user.federateToFollowers(existingReblog.deleteToVersia());

        const newNote = await Note.fromId(id, user.id);

        if (!newNote) {
            throw new ApiError(404, "Note not found");
        }

        return context.json(await newNote.toApi(user), 200);
    }),
);
