import { auth, jsonOrForm } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { PushSubscription } from "@versia/kit/db";
import { RolePermissions } from "~/drizzle/schema";
import { WebPushSubscriptionInput } from "./index.get.schema";

export const route = createRoute({
    method: "put",
    path: "/api/v1/push/subscription",
    summary: "Change types of notifications",
    description:
        "Updates the current push subscription. Only the data part can be updated. To change fundamentals, a new subscription must be created instead.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/push/#update",
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
                    schema: WebPushSubscriptionInput.shape.data,
                },
            },
        },
    },
    responses: {
        200: {
            description: "The WebPushSubscription has been updated.",
            content: {
                "application/json": {
                    schema: PushSubscription.schema,
                },
            },
        },
    },
});
