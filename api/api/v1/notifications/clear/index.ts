import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { RolePermission } from "@versia/client/schemas";

const route = createRoute({
    method: "post",
    path: "/api/v1/notifications/clear",
    summary: "Dismiss all notifications",
    description: "Clear all notifications from the server.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/notifications/#clear",
    },
    tags: ["Notifications"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnNotifications],
            scopes: ["write:notifications"],
        }),
    ] as const,
    responses: {
        200: {
            description: "Notifications successfully cleared.",
        },
        401: reusedResponses[401],
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        await user.clearAllNotifications();

        return context.text("", 200);
    }),
);
