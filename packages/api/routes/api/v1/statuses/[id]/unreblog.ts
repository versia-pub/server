import { RolePermission, Status as StatusSchema } from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { Note } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { apiRoute, auth, withNoteParam } from "@/api";

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

            await user.unreblog(note);

            const newNote = await Note.fromId(note.data.id, user.id);

            if (!newNote) {
                throw ApiError.noteNotFound();
            }

            return context.json(await newNote.toApi(user), 200);
        },
    ),
);
