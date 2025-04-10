import { StatusSource as StatusSourceSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { apiRoute, auth, withNoteParam } from "@/api";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.get(
        "/api/v1/statuses/:id/source",
        describeRoute({
            summary: "View status source",
            description:
                "Obtain the source properties for a status so that it can be edited.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#source",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description: "Status source",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSourceSchema),
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
        (context) => {
            const note = context.get("note");
            return context.json(
                {
                    id: note.id,
                    // TODO: Give real source for spoilerText
                    spoiler_text: note.data.spoilerText,
                    text: note.data.contentSource,
                },
                200,
            );
        },
    ),
);
