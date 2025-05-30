import { z } from "zod";

export const Tag = z
    .object({
        name: z
            .string()
            .min(1)
            .max(128)
            .openapi({
                description: "The value of the hashtag after the # sign.",
                example: "versia",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#Tag-name",
                },
            }),
        url: z
            .string()
            .url()
            .openapi({
                description: "A link to the hashtag on the instance.",
                example: "https://beta.versia.social/tags/versia",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#Tag-url",
                },
            }),
    })
    .openapi({
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#Tag",
        },
        ref: "Tag",
    });
