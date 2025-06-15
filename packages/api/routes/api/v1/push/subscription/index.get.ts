import {
    RolePermission,
    WebPushSubscription as WebPushSubscriptionSchema,
} from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { apiRoute, auth } from "@versia/kit/api";
import { PushSubscription } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";

export default apiRoute((app) =>
    app.get(
        "/api/v1/push/subscription",
        describeRoute({
            summary: "Get current subscription",
            description:
                "View the PushSubscription currently associated with this access token.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/push/#get",
            },
            tags: ["Push Notifications"],
            responses: {
                200: {
                    description: "WebPushSubscription",
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
        async (context) => {
            const { token } = context.get("auth");

            const ps = await PushSubscription.fromToken(token);

            if (!ps) {
                throw ApiError.pushSubscriptionNotFound();
            }

            return context.json(ps.toApi(), 200);
        },
    ),
);
