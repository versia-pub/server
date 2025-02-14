import { z } from "@hono/zod-openapi";
import { Id } from "./common.ts";

export const WebPushSubscription = z
    .object({
        id: Id.openapi({
            example: "24eb1891-accc-43b4-b213-478e37d525b4",
            description: "The ID of the Web Push subscription in the database.",
        }),
        endpoint: z.string().url().openapi({
            example: "https://yourdomain.example/listener",
            description: "Where push alerts will be sent to.",
        }),
        alerts: z
            .object({
                mention: z.boolean().optional().openapi({
                    example: true,
                    description: "Receive mention notifications?",
                }),
                favourite: z.boolean().optional().openapi({
                    example: true,
                    description: "Receive favourite notifications?",
                }),
                reblog: z.boolean().optional().openapi({
                    example: true,
                    description: "Receive reblog notifications?",
                }),
                follow: z.boolean().optional().openapi({
                    example: true,
                    description: "Receive follow notifications?",
                }),
                poll: z.boolean().optional().openapi({
                    example: false,
                    description: "Receive poll notifications?",
                }),
                follow_request: z.boolean().optional().openapi({
                    example: false,
                    description: "Receive follow request notifications?",
                }),
                status: z.boolean().optional().openapi({
                    example: false,
                    description:
                        "Receive new subscribed account notifications?",
                }),
                update: z.boolean().optional().openapi({
                    example: false,
                    description: "Receive status edited notifications?",
                }),
                "admin.sign_up": z.boolean().optional().openapi({
                    example: false,
                    description:
                        "Receive new user signup notifications? Must have a role with the appropriate permissions.",
                }),
                "admin.report": z.boolean().optional().openapi({
                    example: false,
                    description:
                        "Receive new report notifications? Must have a role with the appropriate permissions.",
                }),
            })
            .default({})
            .openapi({
                example: {
                    mention: true,
                    favourite: true,
                    reblog: true,
                    follow: true,
                    poll: false,
                    follow_request: false,
                    status: false,
                    update: false,
                    "admin.sign_up": false,
                    "admin.report": false,
                },
                description:
                    "Which alerts should be delivered to the endpoint.",
            }),
        server_key: z.string().openapi({
            example:
                "BCk-QqERU0q-CfYZjcuB6lnyyOYfJ2AifKqfeGIm7Z-HiTU5T9eTG5GxVA0_OH5mMlI4UkkDTpaZwozy0TzdZ2M=",
            description: "The streaming server’s VAPID key.",
        }),
    })
    .openapi({});

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
                alerts: WebPushSubscription.shape.alerts,
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
