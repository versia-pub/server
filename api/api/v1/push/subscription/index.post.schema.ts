import { auth, jsonOrForm } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { PushSubscription } from "@versia/kit/db";
import { RolePermissions } from "~/drizzle/schema";
import { WebPushSubscriptionInput } from "./index.get.schema";

export const route = createRoute({
    method: "post",
    path: "/api/v1/push/subscription",
    summary: "Subscribe to push notifications",
    description:
        "Add a Web Push API subscription to receive notifications. Each access token can have one push subscription. If you create a new subscription, the old subscription is deleted.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/push/#create",
    },
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.UsePushNotifications],
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
                    schema: PushSubscription.schema,
                },
            },
        },
    },
});
