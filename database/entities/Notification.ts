import type { APINotification } from "~types/entities/notification";
import {
    type StatusWithRelations,
    statusToAPI,
    findFirstStatuses,
} from "./Status";
import {
    type UserWithRelations,
    userToAPI,
    userRelations,
    userExtrasTemplate,
    transformOutputToUserWithRelations,
} from "./User";
import type { InferSelectModel } from "drizzle-orm";
import type { notification } from "~drizzle/schema";
import { db } from "~drizzle/db";

export type Notification = InferSelectModel<typeof notification>;

export type NotificationWithRelations = Notification & {
    status: StatusWithRelations | null;
    account: UserWithRelations;
};

export const findManyNotifications = async (
    query: Parameters<typeof db.query.notification.findMany>[0],
): Promise<NotificationWithRelations[]> => {
    const output = await db.query.notification.findMany({
        ...query,
        with: {
            ...query?.with,
            account: {
                with: {
                    ...userRelations,
                },
                extras: userExtrasTemplate("notification_account"),
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
            status: notif.statusId
                ? await findFirstStatuses({
                      where: (status, { eq }) =>
                          eq(status.id, notif.statusId ?? ""),
                  })
                : null,
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
            ? await statusToAPI(notification.status, notification.account)
            : undefined,
    };
};
