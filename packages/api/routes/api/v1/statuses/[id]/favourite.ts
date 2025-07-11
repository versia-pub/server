import { RolePermission, Status as StatusSchema } from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, withNoteParam } from "@versia-server/kit/api";
import { describeRoute, resolver } from "hono-openapi";

export default apiRoute((app) =>
    app.post(
        "/api/v1/statuses/:id/favourite",
        describeRoute({
            summary: "Favourite a status",
            description: "Add a status to your favourites list.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#favourite",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description: "Status favourited or was already favourited",
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
                RolePermission.ManageOwnLikes,
                RolePermission.ViewNotes,
            ],
        }),
        withNoteParam,
        async (context) => {
            const { user } = context.get("auth");
            const note = context.get("note");

            await note.like(user);

            await note.reload(user.id);

            return context.json(await note.toApi(user), 200);
        },
    ),
);
