import type { InferSelectModel } from "drizzle-orm";
import { db } from "~drizzle/db";
import type { Notifications } from "~drizzle/schema";
import { Note } from "~packages/database-interface/note";
import type { Notification as APINotification } from "~types/mastodon/notification";
import type { StatusWithRelations } from "./Status";
import {
    type UserWithRelations,
    transformOutputToUserWithRelations,
    userExtrasTemplate,
    userRelations,
    userToAPI,
} from "./User";

export type Notification = InferSelectModel<typeof Notifications>;

export type NotificationWithRelations = Notification & {
    status: StatusWithRelations | null;
    account: UserWithRelations;
};

export const findManyNotifications = async (
    query: Parameters<typeof db.query.Notifications.findMany>[0],
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
            status: (await Note.fromId(notif.noteId))?.getStatus() ?? null,
        })),
    );
};

export const notificationToAPI = async (
    notification: NotificationWithRelations,
): Promise<APINotification> => {
    return {
        account: userToAPI(notification.account),
        created_at: new Date(notification.createdAt).toISOString(),
        id: notification.id,
        type: notification.type,
        status: notification.status
            ? await Note.fromStatus(notification.status).toAPI(
                  notification.account,
              )
            : undefined,
    };
};
