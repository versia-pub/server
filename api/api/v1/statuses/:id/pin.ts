import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note, db } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import type { SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/pin",
    summary: "Pin a status",
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
            description: "Pinned status",
            content: {
                "application/json": {
                    schema: Note.schema,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        422: {
            description: "Already pinned",
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
        const { user } = context.get("auth");
        const note = context.get("note");

        if (note.author.id !== user.id) {
            throw new ApiError(401, "Unauthorized");
        }

        if (
            await db.query.UserToPinnedNotes.findFirst({
                where: (userPinnedNote, { and, eq }): SQL | undefined =>
                    and(
                        eq(userPinnedNote.noteId, note.data.id),
                        eq(userPinnedNote.userId, user.id),
                    ),
            })
        ) {
            throw new ApiError(422, "Already pinned");
        }

        await user.pin(note);

        return context.json(await note.toApi(user), 200);
    }),
);
