import {
    apiRoute,
    auth,
    noteNotFound,
    reusedResponses,
    withNoteParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Status as StatusSchema } from "@versia/client-ng/schemas";
import { Note } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, eq } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/unreblog",
    summary: "Undo boost of a status",
    description: "Undo a reshare of a status.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#unreblog",
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
            description: "Status unboosted or was already not boosted",
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
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");
        const note = context.get("note");

        const existingReblog = await Note.fromSql(
            and(eq(Notes.authorId, user.id), eq(Notes.reblogId, note.data.id)),
            undefined,
            user?.id,
        );

        if (!existingReblog) {
            return context.json(await note.toApi(user), 200);
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
