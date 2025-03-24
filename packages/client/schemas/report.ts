import { z } from "@hono/zod-openapi";
import { Account } from "./account.ts";
import { Id } from "./common.ts";

export const Report = z
    .object({
        id: Id.openapi({
            description: "The ID of the report in the database.",
            example: "9b0cd757-324b-4ea6-beab-f6226e138886",
        }),
        action_taken: z.boolean().openapi({
            description: "Whether an action was taken yet.",
            example: false,
        }),
        action_taken_at: z.string().datetime().nullable().openapi({
            description: "When an action was taken against the report.",
            example: null,
        }),
        category: z.enum(["spam", "violation", "other"]).openapi({
            description:
                "The generic reason for the report. 'spam' = Unwanted or repetitive content, 'violation' = A specific rule was violated, 'other' = Some other reason.",
            example: "spam",
        }),
        comment: z.string().openapi({
            description: "The reason for the report.",
            example: "Spam account",
        }),
        forwarded: z.boolean().openapi({
            description: "Whether the report was forwarded to a remote domain.",
            example: false,
        }),
        created_at: z.string().datetime().openapi({
            description: "When the report was created.",
            example: "2024-12-31T23:59:59.999Z",
        }),
        status_ids: z
            .array(Id)
            .nullable()
            .openapi({
                description:
                    "IDs of statuses that have been attached to this report for additional context.",
                example: ["1abf027c-af03-46ff-8d17-9ee799a17ca7"],
            }),
        rule_ids: z.array(z.string()).nullable().openapi({
            description:
                "IDs of the rules that have been cited as a violation by this report.",
            example: null,
        }),
        target_account: Account.openapi({
            description: "The account that was reported.",
        }),
    })
    .openapi("Report", {
        description:
            "Reports filed against users and/or statuses, to be taken action on by moderators.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Report",
        },
    });
