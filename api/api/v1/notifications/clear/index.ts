import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { RolePermissions } from "@versia/kit/tables";

const route = createRoute({
    method: "post",
    path: "/api/v1/notifications/clear",
    summary: "Clear notifications",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnNotifications],
            scopes: ["write:notifications"],
        }),
    ] as const,
    responses: {
        200: {
            description: "Notifications cleared",
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        await user.clearAllNotifications();

        return context.text("", 200);
    }),
);
