import { z } from "zod/v4";
import { Account } from "./account.ts";
import { AccountWarning } from "./account-warning.ts";
import { Id } from "./common.ts";
import { Report } from "./report.ts";
import { Status } from "./status.ts";

export const Notification = z
    .object({
        id: Id.meta({
            description: "The ID of the notification in the database.",
            example: "6405f495-da55-4ad7-b5d6-9a773360fc07",
        }),
        type: z
            .enum([
                "mention",
                "status",
                "reblog",
                "follow",
                "follow_request",
                "favourite",
                "poll",
                "update",
                "reaction",
                "admin.sign_up",
                "admin.report",
                "severed_relationships",
                "moderation_warning",
            ])
            .meta({
                description:
                    "The type of event that resulted in the notification.",
                example: "mention",
            }),
        group_key: z.string().meta({
            description:
                "Group key shared by similar notifications, to be used in the grouped notifications feature.",
            example: "ungrouped-34975861",
        }),
        created_at: z.iso.datetime().meta({
            description: "The timestamp of the notification.",
            example: "2025-01-12T13:11:00Z",
        }),
        account: Account.meta({
            description:
                "The account that performed the action that generated the notification.",
        }),
        status: Status.optional().meta({
            description:
                "Status that was the object of the notification. Attached when type of the notification is favourite, reblog, status, mention, poll, or update.",
        }),
        report: Report.optional().meta({
            description:
                "Report that was the object of the notification. Attached when type of the notification is admin.report.",
        }),
        event: z.undefined().meta({
            description:
                "Versia Server does not sever relationships, so this field is always empty.",
        }),
        moderation_warning: AccountWarning.optional().meta({
            description:
                "Moderation warning that caused the notification. Attached when type of the notification is moderation_warning.",
        }),
    })
    .meta({
        description:
            "Represents a notification of an event relevant to the user.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Notification",
        },
        id: "Notification",
    });
