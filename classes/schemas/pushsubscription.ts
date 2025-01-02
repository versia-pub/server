import { z } from "@hono/zod-openapi";
import { PushSubscription } from "@versia/kit/db";

export const WebPushSubscriptionInput = z
    .object({
        subscription: z.object({
            endpoint: z.string().url().openapi({
                example: "https://yourdomain.example/listener",
                description: "Where push alerts will be sent to.",
            }),
            keys: z
                .object({
                    p256dh: z.string().base64url().openapi({
                        description:
                            "User agent public key. Base64url encoded string of a public key from a ECDH keypair using the prime256v1 curve.",
                        example:
                            "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEoKCJeHCy69ywHcb3dAR/T8Sud5ljSFHJkuiR6it1ycqAjGTe5F1oZ0ef5QiMX/zdQ+d4jSKiO7RztIz+o/eGuQ==",
                    }),
                    auth: z.string().base64url().openapi({
                        description:
                            "Auth secret. Base64url encoded string of 16 bytes of random data.",
                        example: "u67u09PXZW4ncK9l9mAXkA==",
                    }),
                })
                .strict(),
        }),
        policy: z
            .enum(["all", "followed", "follower", "none"])
            .default("all")
            .openapi({
                description:
                    "Specify whether to receive push notifications from all, followed, follower, or none users.",
            }),
        data: z
            .object({
                alerts: PushSubscription.schema.shape.alerts,
            })
            .strict()
            .default({
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
