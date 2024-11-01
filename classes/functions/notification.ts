import type { Notification as ApiNotification } from "@versia/client/types";
import { Note, User, db } from "@versia/kit/db";
import type { Notifications } from "@versia/kit/tables";
import type { InferSelectModel } from "drizzle-orm";
import type { StatusWithRelations } from "./status.ts";
import {
    type UserWithRelations,
    transformOutputToUserWithRelations,
    userExtrasTemplate,
    userRelations,
} from "./user.ts";

export type Notification = InferSelectModel<typeof Notifications>;

export type NotificationWithRelations = Notification & {
    status: StatusWithRelations | null;
    account: UserWithRelations;
};

export const findManyNotifications = async (
    query: Parameters<typeof db.query.Notifications.findMany>[0],
    userId?: string,
): Promise<NotificationWithRelations[]> => {
    const output = await db.query.Notifications.findMany({
        ...query,
        with: {
            ...query?.with,
            account: {
                with: {
                    ...userRelations,
                },
                extras: userExtrasTemplate("Notifications_account"),
            },
        },
        extras: {
            ...query?.extras,
        },
    });

    return await Promise.all(
        output.map(async (notif) => ({
            ...notif,
            account: transformOutputToUserWithRelations(notif.account),
            status: (await Note.fromId(notif.noteId, userId))?.data ?? null,
        })),
    );
};

export const notificationToApi = async (
    notification: NotificationWithRelations,
): Promise<ApiNotification> => {
    const account = new User(notification.account);
    return {
        account: account.toApi(),
        created_at: new Date(notification.createdAt).toISOString(),
        id: notification.id,
        type: notification.type,
        status: notification.status
            ? await new Note(notification.status).toApi(account)
            : undefined,
    };
};
