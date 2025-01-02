import { auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { PushSubscription } from "@versia/kit/db";
import { RolePermissions } from "~/drizzle/schema";

export const WebPushSubscriptionInput = z
    .object({
        subscription: z.object({
            endpoint: z.string().url().openapi({
                example: "https://yourdomain.example/listener",
                description: "Where push alerts will be sent to.",
            }),
            keys: z
                .object({
                    p256dh: z.string().base64().openapi({
                        description:
                            "User agent public key. Base64 encoded string of a public key from a ECDH keypair using the prime256v1 curve.",
                        example:
                            "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEoKCJeHCy69ywHcb3dAR/T8Sud5ljSFHJkuiR6it1ycqAjGTe5F1oZ0ef5QiMX/zdQ+d4jSKiO7RztIz+o/eGuQ==",
                    }),
                    auth: z.string().base64().length(24).openapi({
                        description:
                            "Auth secret. Base64 encoded string of 16 bytes of random data.",
                        example: "u67u09PXZW4ncK9l9mAXkA==",
                    }),
                })
                .strict(),
        }),
        data: z
            .object({
                policy: z
                    .enum(["all", "followed", "follower", "none"])
                    .default("all")
                    .openapi({
                        description:
                            "Specify whether to receive push notifications from all, followed, follower, or none users.",
                    }),
                alerts: PushSubscription.schema.shape.alerts,
            })
            .strict()
            .default({
                policy: "all",
                alerts: {
                    mention: false,
                    favourite: false,
                    reblog: false,
                    follow: false,
                    poll: false,
                    follow_request: false,
                    status: false,
                    update: false,
                    "admin.sign_up": false,
                    "admin.report": false,
                },
            }),
    })
    .strict();

export const route = createRoute({
    method: "get",
    path: "/api/v1/push/subscription",
    summary: "Get current subscription",
    description:
        "View the PushSubscription currently associated with this access token.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/push/#get",
    },
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.UsePushNotifications],
            scopes: ["push"],
        }),
    ] as const,
    responses: {
        200: {
            description: "WebPushSubscription",
            content: {
                "application/json": {
                    schema: PushSubscription.schema,
                },
            },
        },
    },
});
