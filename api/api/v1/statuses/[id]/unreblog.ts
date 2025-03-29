import { apiRoute, auth, withNoteParam } from "@/api";
import { Status as StatusSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Note } from "@versia/kit/db";
import { Notes } from "@versia/kit/tables";
import { and, eq } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.post(
        "/api/v1/statuses/:id/unreblog",
        describeRoute({
            summary: "Undo boost of a status",
            description: "Undo a reshare of a status.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#unreblog",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description: "Status unboosted or was already not boosted",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSchema),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
                401: ApiError.missingAuthentication().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnNotes,
                RolePermission.ViewNotes,
            ],
        }),
        withNoteParam,
        async (context) => {
            const { user } = context.get("auth");
            const note = context.get("note");

            const existingReblog = await Note.fromSql(
                and(
                    eq(Notes.authorId, user.id),
                    eq(Notes.reblogId, note.data.id),
                ),
                undefined,
                user?.id,
            );

            if (!existingReblog) {
                return context.json(await note.toApi(user), 200);
            }

            await existingReblog.delete();

            await user.federateToFollowers(existingReblog.deleteToVersia());

            const newNote = await Note.fromId(note.data.id, user.id);

            if (!newNote) {
                throw ApiError.noteNotFound();
            }

            return context.json(await newNote.toApi(user), 200);
        },
    ),
);
