import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { WebPushSubscription as WebPushSubscriptionSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { PushSubscription } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.openapi(
        createRoute({
            method: "get",
            path: "/api/v1/push/subscription",
            summary: "Get current subscription",
            description:
                "View the PushSubscription currently associated with this access token.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/push/#get",
            },
            tags: ["Push Notifications"],
            middleware: [
                auth({
                    auth: true,
                    permissions: [RolePermission.UsePushNotifications],
                    scopes: ["push"],
                }),
            ] as const,
            responses: {
                200: {
                    description: "WebPushSubscription",
                    content: {
                        "application/json": {
                            schema: WebPushSubscriptionSchema,
                        },
                    },
                },
                ...reusedResponses,
            },
        }),
        async (context) => {
            const { token } = context.get("auth");

            const ps = await PushSubscription.fromToken(token);

            if (!ps) {
                throw new ApiError(
                    404,
                    "No push subscription associated with this access token",
                );
            }

            return context.json(ps.toApi(), 200);
        },
    ),
);
