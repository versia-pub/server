import { z } from "zod/v4";

export const Tag = z
    .object({
        name: z
            .string()
            .min(1)
            .max(128)
            .meta({
                description: "The value of the hashtag after the # sign.",
                example: "versia",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Status/#Tag-name",
                },
            }),
        url: z.url().meta({
            description: "A link to the hashtag on the instance.",
            example: "https://beta.versia.social/tags/versia",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Status/#Tag-url",
            },
        }),
    })
    .meta({
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Status/#Tag",
        },
        id: "Tag",
    });
