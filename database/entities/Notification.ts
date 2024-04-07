import type { Notification } from "@prisma/client";
import type { APINotification } from "~types/entities/notification";
import { type StatusWithRelations, statusToAPI } from "./Status";
import { type UserWithRelations, userToAPI } from "./User";

export type NotificationWithRelations = Notification & {
    status: StatusWithRelations | null;
    account: UserWithRelations;
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
