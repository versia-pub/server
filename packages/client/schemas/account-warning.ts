import { z } from "zod/v4";
import { Account } from "./account.ts";
import { Appeal } from "./appeal.ts";
import { Id } from "./common.ts";

export const AccountWarning = z
    .object({
        id: Id.meta({
            description: "The ID of the account warning in the database.",
            example: "0968680e-fd64-4525-b818-6e1c46fbdb28",
        }),
        action: z
            .enum([
                "none",
                "disable",
                "mark_statuses_as_sensitive",
                "delete_statuses",
                "sensitive",
                "silence",
                "suspend",
            ])
            .meta({
                description:
                    "Action taken against the account. 'none' = No action was taken, this is a simple warning; 'disable' = The account has been disabled; 'mark_statuses_as_sensitive' = Specific posts from the target account have been marked as sensitive; 'delete_statuses' = Specific statuses from the target account have been deleted; 'sensitive' = All posts from the target account are marked as sensitive; 'silence' = The target account has been limited; 'suspend' = The target account has been suspended.",
                example: "none",
            }),
        text: z.string().meta({
            description: "Message from the moderator to the target account.",
            example: "Please adhere to our community guidelines.",
        }),
        status_ids: z
            .array(Id)
            .nullable()
            .meta({
                description:
                    "List of status IDs that are relevant to the warning. When action is mark_statuses_as_sensitive or delete_statuses, those are the affected statuses.",
                example: ["5ee59275-c308-4173-bb1f-58646204579b"],
            }),
        target_account: Account.meta({
            description:
                "Account against which a moderation decision has been taken.",
        }),
        appeal: Appeal.nullable().meta({
            description: "Appeal submitted by the target account, if any.",
            example: null,
        }),
        created_at: z.iso.datetime().meta({
            description: "When the event took place.",
            example: "2025-01-04T14:11:00Z",
        }),
    })
    .meta({
        description: "Moderation warning against a particular account.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/AccountWarning",
        },
        id: "AccountWarning",
    });
