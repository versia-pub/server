import { apiRoute, reusedResponses } from "@/api";
import { auth, jsonOrForm } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import {
    WebPushSubscriptionInput,
    WebPushSubscription as WebPushSubscriptionSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { PushSubscription } from "@versia/kit/db";

export default apiRoute((app) =>
    app.openapi(
        createRoute({
            method: "post",
            path: "/api/v1/push/subscription",
            summary: "Subscribe to push notifications",
            description:
                "Add a Web Push API subscription to receive notifications. Each access token can have one push subscription. If you create a new subscription, the old subscription is deleted.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/push/#create",
            },
            tags: ["Push Notifications"],
            middleware: [
                auth({
                    auth: true,
                    permissions: [RolePermission.UsePushNotifications],
                    scopes: ["push"],
                }),
                jsonOrForm(),
            ] as const,
            request: {
                body: {
                    content: {
                        "application/json": {
                            schema: WebPushSubscriptionInput,
                        },
                    },
                },
            },
            responses: {
                200: {
                    description:
                        "A new PushSubscription has been generated, which will send the requested alerts to your endpoint.",
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
            const { user, token } = context.get("auth");
            const { subscription, data, policy } = context.req.valid("json");

            if (
                data.alerts["admin.report"] &&
                !user.hasPermission(RolePermission.ManageReports)
            ) {
                // This shouldn't throw an error in mastodon either
                data.alerts["admin.report"] = false;
            }

            if (
                data.alerts["admin.sign_up"] &&
                !user.hasPermission(RolePermission.ManageAccounts)
            ) {
                data.alerts["admin.sign_up"] = false;
            }

            await PushSubscription.clearAllOfToken(token);

            const ps = await PushSubscription.insert({
                alerts: data.alerts,
                policy,
                endpoint: subscription.endpoint,
                publicKey: subscription.keys.p256dh,
                authSecret: subscription.keys.auth,
                tokenId: token.id,
            });

            return context.json(ps.toApi(), 200);
        },
    ),
);
