import { z } from "@hono/zod-openapi";

export const PrivacyPolicy = z
    .object({
        updated_at: z
            .string()
            .datetime()
            .openapi({
                description:
                    "A timestamp of when the privacy policy was last updated.",
                example: "2025-01-12T13:11:00Z",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/PrivacyPolicy/#updated_at",
                },
            }),
        content: z.string().openapi({
            description: "The rendered HTML content of the privacy policy.",
            example: "<p><h1>Privacy Policy</h1><p>None, good luck.</p></p>",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/PrivacyPolicy/#content",
            },
        }),
    })
    .openapi({
        description: "Represents the privacy policy of the instance.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/PrivacyPolicy",
        },
    });
