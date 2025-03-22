import { z } from "@hono/zod-openapi";

export const Appeal = z
    .object({
        text: z.string().openapi({
            description:
                "Text of the appeal from the moderated account to the moderators.",
            example: "I believe this action was taken in error.",
        }),
        state: z.enum(["approved", "rejected", "pending"]).openapi({
            description:
                "State of the appeal. 'approved' = The appeal has been approved by a moderator, 'rejected' = The appeal has been rejected by a moderator, 'pending' = The appeal has been submitted, but neither approved nor rejected yet.",
            example: "pending",
        }),
    })
    .openapi({
        description: "Appeal against a moderation action.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Appeal",
        },
    });
