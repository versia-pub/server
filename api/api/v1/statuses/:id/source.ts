import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Status as StatusSchema,
    StatusSource as StatusSourceSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "get",
    path: "/api/v1/statuses/{id}/source",
    summary: "View status source",
    description:
        "Obtain the source properties for a status so that it can be edited.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#source",
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
            description: "Status source",
            content: {
                "application/json": {
                    schema: StatusSourceSchema,
                },
            },
        },
        404: ApiError.noteNotFound().schema,
        401: ApiError.missingAuthentication().schema,
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
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
    }),
);
