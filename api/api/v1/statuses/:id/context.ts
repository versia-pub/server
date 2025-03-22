import {
    apiRoute,
    auth,
    noteNotFound,
    reusedResponses,
    withNoteParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Context as ContextSchema,
    Status as StatusSchema,
} from "@versia/client-ng/schemas";
import { RolePermissions } from "@versia/kit/tables";

const route = createRoute({
    method: "get",
    path: "/api/v1/statuses/{id}/context",
    summary: "Get parent and child statuses in context",
    description: "View statuses above and below this status in the thread.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#context",
    },
    tags: ["Statuses"],
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.ViewNotes],
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
            description: "Status parent and children",
            content: {
                "application/json": {
                    schema: ContextSchema,
                },
            },
        },
        404: noteNotFound,
        401: reusedResponses[401],
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
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
    }),
);
