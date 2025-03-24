import { z } from "@hono/zod-openapi";
import { Id, iso631 } from "./common.ts";

export const Relationship = z
    .object({
        id: Id.openapi({
            description: "The account ID.",
            example: "51f34c31-c8c6-4dc2-9df1-3704fcdde9b6",
        }),
        following: z.boolean().openapi({
            description: "Are you following this user?",
            example: true,
        }),
        showing_reblogs: z.boolean().openapi({
            description:
                "Are you receiving this user’s boosts in your home timeline?",
            example: true,
        }),
        notifying: z.boolean().openapi({
            description: "Have you enabled notifications for this user?",
            example: false,
        }),
        languages: z.array(iso631).openapi({
            description: "Which languages are you following from this user?",
            example: ["en"],
        }),
        followed_by: z.boolean().openapi({
            description: "Are you followed by this user?",
            example: true,
        }),
        blocking: z.boolean().openapi({
            description: "Are you blocking this user?",
            example: false,
        }),
        blocked_by: z.boolean().openapi({
            description: "Is this user blocking you?",
            example: false,
        }),
        muting: z.boolean().openapi({
            description: "Are you muting this user?",
            example: false,
        }),
        muting_notifications: z.boolean().openapi({
            description: "Are you muting notifications from this user?",
            example: false,
        }),
        requested: z.boolean().openapi({
            description: "Do you have a pending follow request for this user?",
            example: false,
        }),
        requested_by: z.boolean().openapi({
            description: "Has this user requested to follow you?",
            example: false,
        }),
        domain_blocking: z.boolean().openapi({
            description: "Are you blocking this user’s domain?",
            example: false,
        }),
        endorsed: z.boolean().openapi({
            description: "Are you featuring this user on your profile?",
            example: false,
        }),
        note: z.string().min(0).max(5000).trim().openapi({
            description: "This user’s profile bio",
            example: "they also like Kerbal Space Program",
        }),
    })
    .openapi("Relationship", {
        description:
            "Represents the relationship between accounts, such as following / blocking / muting / etc.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Relationship",
        },
    });
