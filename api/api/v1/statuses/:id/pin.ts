import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Status as StatusSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { db } from "@versia/kit/db";
import type { SQL } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/pin",
    summary: "Pin status to profile",
    description:
        "Feature one of your own public statuses at the top of your profile.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#pin",
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
            description:
                "Status pinned. Note the status is not a reblog and its authoring account is your own.",
            content: {
                "application/json": {
                    schema: StatusSchema,
                },
            },
        },
        404: ApiError.noteNotFound().schema,
        403: ApiError.forbidden().schema,
        401: ApiError.missingAuthentication().schema,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        const note = context.get("note");

        if (note.author.id !== user.id) {
            throw ApiError.forbidden();
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
            return context.json(await note.toApi(user), 200);
        }

        await user.pin(note);

        return context.json(await note.toApi(user), 200);
    }),
);
