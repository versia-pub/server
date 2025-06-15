import { RolePermission, Status as StatusSchema } from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { apiRoute, auth, withNoteParam } from "@versia/kit/api";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";

export default apiRoute((app) =>
    app.post(
        "/api/v1/statuses/:id/unpin",
        describeRoute({
            summary: "Unpin status from profile",
            description: "Unfeature a status from the top of your profile.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#unpin",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description: "Status unpinned, or was already not pinned",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSchema),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
                403: ApiError.forbidden().schema,
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

            if (note.author.id !== user.id) {
                throw ApiError.forbidden();
            }

            await user.unpin(note);

            if (!note) {
                throw ApiError.noteNotFound();
            }

            return context.json(await note.toApi(user), 200);
        },
    ),
);
