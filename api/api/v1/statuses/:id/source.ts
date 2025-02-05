import { apiRoute, auth, withNoteParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import type { StatusSource as ApiStatusSource } from "@versia/client/types";
import { RolePermissions } from "@versia/kit/tables";

const route = createRoute({
    method: "get",
    path: "/api/v1/statuses/{id}/source",
    summary: "Get status source",
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
            description: "Status source",
            content: {
                "application/json": {
                    schema: z.object({
                        id: z.string().uuid(),
                        spoiler_text: z.string(),
                        text: z.string(),
                    }),
                },
            },
        },
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
            } satisfies ApiStatusSource,
            200,
        );
    }),
);
