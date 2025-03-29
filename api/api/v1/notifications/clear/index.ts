import { apiRoute, auth } from "@/api";
import { RolePermission } from "@versia/client/schemas";
import { describeRoute } from "hono-openapi";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.post(
        "/api/v1/notifications/clear",
        describeRoute({
            summary: "Dismiss all notifications",
            description: "Clear all notifications from the server.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/notifications/#clear",
            },
            tags: ["Notifications"],
            responses: {
                200: {
                    description: "Notifications successfully cleared.",
                },
                401: ApiError.missingAuthentication().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnNotifications],
            scopes: ["write:notifications"],
        }),
        async (context) => {
            const { user } = context.get("auth");

            await user.clearAllNotifications();

            return context.text("", 200);
        },
    ),
);
