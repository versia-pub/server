import { z } from "zod/v4";
import { Account } from "./account.ts";
import { Id } from "./common.ts";

export const Report = z
    .object({
        id: Id.meta({
            description: "The ID of the report in the database.",
            example: "9b0cd757-324b-4ea6-beab-f6226e138886",
        }),
        action_taken: z.boolean().meta({
            description: "Whether an action was taken yet.",
            example: false,
        }),
        action_taken_at: z.iso.datetime().nullable().meta({
            description: "When an action was taken against the report.",
            example: null,
        }),
        category: z.enum(["spam", "violation", "other"]).meta({
            description:
                "The generic reason for the report. 'spam' = Unwanted or repetitive content, 'violation' = A specific rule was violated, 'other' = Some other reason.",
            example: "spam",
        }),
        comment: z.string().meta({
            description: "The reason for the report.",
            example: "Spam account",
        }),
        forwarded: z.boolean().meta({
            description: "Whether the report was forwarded to a remote domain.",
            example: false,
        }),
        created_at: z.iso.datetime().meta({
            description: "When the report was created.",
            example: "2024-12-31T23:59:59.999Z",
        }),
        status_ids: z
            .array(Id)
            .nullable()
            .meta({
                description:
                    "IDs of statuses that have been attached to this report for additional context.",
                example: ["1abf027c-af03-46ff-8d17-9ee799a17ca7"],
            }),
        rule_ids: z.array(z.string()).nullable().meta({
            description:
                "IDs of the rules that have been cited as a violation by this report.",
            example: null,
        }),
        target_account: Account.meta({
            description: "The account that was reported.",
        }),
    })
    .meta({
        description:
            "Reports filed against users and/or statuses, to be taken action on by moderators.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Report",
        },
        id: "Report",
    });
