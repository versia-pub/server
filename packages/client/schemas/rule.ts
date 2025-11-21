import { z } from "zod";

export const Rule = z
    .object({
        id: z.string().meta({
            description: "The identifier for the rule.",
            example: "1",
        }),
        text: z.string().meta({
            description: "The rule to be followed.",
            example: "Do not spam pictures of skibidi toilet.",
        }),
        hint: z.string().optional().meta({
            description: "Longer-form description of the rule.",
            example: "Please, we beg you.",
        }),
    })
    .meta({
        description: "Represents a rule that server users should follow.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Rule",
        },
        id: "Rule",
    });
