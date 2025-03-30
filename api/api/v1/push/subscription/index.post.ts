import { apiRoute, handleZodError } from "@/api";
import { auth, jsonOrForm } from "@/api";
import {
    WebPushSubscriptionInput,
    WebPushSubscription as WebPushSubscriptionSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { PushSubscription } from "@versia/kit/db";
import { randomUUIDv7 } from "bun";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.post(
        "/api/v1/push/subscription",
        describeRoute({
            summary: "Subscribe to push notifications",
            description:
                "Add a Web Push API subscription to receive notifications. Each access token can have one push subscription. If you create a new subscription, the old subscription is deleted.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/push/#create",
            },
            tags: ["Push Notifications"],
            responses: {
                200: {
                    description:
                        "A new PushSubscription has been generated, which will send the requested alerts to your endpoint.",
                    content: {
                        "application/json": {
                            schema: resolver(WebPushSubscriptionSchema),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.UsePushNotifications],
            scopes: ["push"],
        }),
        jsonOrForm(),
        validator("json", WebPushSubscriptionInput, handleZodError),
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
                id: randomUUIDv7(),
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
