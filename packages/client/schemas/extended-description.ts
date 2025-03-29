import { z } from "zod";

export const ExtendedDescription = z
    .object({
        updated_at: z
            .string()
            .datetime()
            .openapi({
                description:
                    "A timestamp of when the extended description was last updated.",
                example: "2025-01-12T13:11:00Z",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/ExtendedDescription/#updated_at",
                },
            }),
        content: z.string().openapi({
            description:
                "The rendered HTML content of the extended description.",
            example: "<p>We love casting spells.</p>",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/ExtendedDescription/#content",
            },
        }),
    })
    .openapi({
        description:
            "Represents an extended description for the instance, to be shown on its about page.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/ExtendedDescription",
        },
        ref: "ExtendedDescription",
    });
