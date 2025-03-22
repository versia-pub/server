import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { RolePermission } from "@versia/client/schemas";

const schemas = {
    query: z.object({
        "ids[]": z.array(z.string().uuid()),
    }),
};

const route = createRoute({
    method: "delete",
    path: "/api/v1/notifications/destroy_multiple",
    summary: "Dismiss multiple notifications",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnNotifications],
            scopes: ["write:notifications"],
        }),
    ] as const,
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Notifications dismissed",
        },
        401: reusedResponses[401],
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        const { "ids[]": ids } = context.req.valid("query");

        await user.clearSomeNotifications(ids);

        return context.text("", 200);
    }),
);
