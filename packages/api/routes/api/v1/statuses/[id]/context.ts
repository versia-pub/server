import {
    Context as ContextSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, withNoteParam } from "@versia-server/kit/api";
import { describeRoute, resolver } from "hono-openapi";

export default apiRoute((app) =>
    app.get(
        "/api/v1/statuses/:id/context",
        describeRoute({
            summary: "Get parent and child statuses in context",
            description:
                "View statuses above and below this status in the thread.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#context",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description: "Status parent and children",
                    content: {
                        "application/json": {
                            schema: resolver(ContextSchema),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
                401: ApiError.missingAuthentication().schema,
            },
        }),
        auth({
            auth: false,
            permissions: [RolePermission.ViewNotes],
        }),
        withNoteParam,
        async (context) => {
            const { user } = context.get("auth");
            const note = context.get("note");

            const ancestors = await note.getAncestors(user ?? null);

            const descendants = await note.getDescendants(user ?? null);

            return context.json(
                {
                    ancestors: await Promise.all(
                        ancestors.map((status) => status.toApi(user)),
                    ),
                    descendants: await Promise.all(
                        descendants.map((status) => status.toApi(user)),
                    ),
                },
                200,
            );
        },
    ),
);
