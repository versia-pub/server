import { z } from "zod/v4";

export const ExtendedDescription = z
    .object({
        updated_at: z.iso.datetime().meta({
            description:
                "A timestamp of when the extended description was last updated.",
            example: "2025-01-12T13:11:00Z",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/ExtendedDescription/#updated_at",
            },
        }),
        content: z.string().meta({
            description:
                "The rendered HTML content of the extended description.",
            example: "<p>We love casting spells.</p>",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/ExtendedDescription/#content",
            },
        }),
    })
    .meta({
        description:
            "Represents an extended description for the instance, to be shown on its about page.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/ExtendedDescription",
        },
        id: "ExtendedDescription",
    });
