import { z } from "zod";

export const PrivacyPolicy = z
    .object({
        updated_at: z.iso.datetime().meta({
            description:
                "A timestamp of when the privacy policy was last updated.",
            example: "2025-01-12T13:11:00Z",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/PrivacyPolicy/#updated_at",
            },
        }),
        content: z.string().meta({
            description: "The rendered HTML content of the privacy policy.",
            example: "<p><h1>Privacy Policy</h1><p>None, good luck.</p></p>",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/PrivacyPolicy/#content",
            },
        }),
    })
    .meta({
        description: "Represents the privacy policy of the instance.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/PrivacyPolicy",
        },
        id: "PrivacyPolicy",
    });
