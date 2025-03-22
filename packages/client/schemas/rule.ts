import { z } from "@hono/zod-openapi";

export const Rule = z
    .object({
        id: z.string().openapi({
            description: "The identifier for the rule.",
            example: "1",
        }),
        text: z.string().openapi({
            description: "The rule to be followed.",
            example: "Do not spam pictures of skibidi toilet.",
        }),
        hint: z.string().optional().openapi({
            description: "Longer-form description of the rule.",
            example: "Please, we beg you.",
        }),
    })
    .openapi({
        description: "Represents a rule that server users should follow.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Rule",
        },
    });
