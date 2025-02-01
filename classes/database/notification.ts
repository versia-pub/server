import type { Notification as APINotification } from "@versia/client/types";
import { Note, User, db } from "@versia/kit/db";
import { Notifications } from "@versia/kit/tables";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { z } from "zod";
import {
    transformOutputToUserWithRelations,
    userExtrasTemplate,
    userRelations,
} from "../functions/user.ts";
import { BaseInterface } from "./base.ts";

export type NotificationType = InferSelectModel<typeof Notifications> & {
    status: typeof Note.$type | null;
    account: typeof User.$type;
};

export class Notification extends BaseInterface<
    typeof Notifications,
    NotificationType
> {
    public static schema: z.ZodType<APINotification> = z.object({
        account: z.lazy(() => User.schema).nullable(),
        created_at: z.string(),
        id: z.string().uuid(),
        status: z.lazy(() => Note.schema).optional(),
        // TODO: Add reactions
        type: z.enum([
            "mention",
            "status",
            "follow",
            "follow_request",
            "reblog",
            "poll",
            "favourite",
            "update",
            "admin.sign_up",
            "admin.report",
            "chat",
            "pleroma:chat_mention",
            "pleroma:emoji_reaction",
            "pleroma:event_reminder",
            "pleroma:participation_request",
            "pleroma:participation_accepted",
            "move",
            "group_reblog",
            "group_favourite",
            "user_approved",
        ]),
        target: z.lazy(() => User.schema).optional(),
    });

    public async reload(): Promise<void> {
        const reloaded = await Notification.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload notification");
        }

        this.data = reloaded.data;
    }

    public static async fromId(
        id: string | null,
        userId?: string,
    ): Promise<Notification | null> {
        if (!id) {
            return null;
        }

        return await Notification.fromSql(
            eq(Notifications.id, id),
            undefined,
            userId,
        );
    }

    public static async fromIds(
        ids: string[],
        userId?: string,
    ): Promise<Notification[]> {
        return await Notification.manyFromSql(
            inArray(Notifications.id, ids),
            undefined,
            undefined,
            undefined,
            undefined,
            userId,
        );
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Notifications.id),
        userId?: string,
    ): Promise<Notification | null> {
        const found = await db.query.Notifications.findFirst({
            where: sql,
            orderBy,
            with: {
                account: {
                    with: {
                        ...userRelations,
                    },
                    extras: userExtrasTemplate("Notifications_account"),
                },
            },
        });

        if (!found) {
            return null;
        }
        return new Notification({
            ...found,
            account: transformOutputToUserWithRelations(found.account),
            status: (await Note.fromId(found.noteId, userId))?.data ?? null,
        });
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Notifications.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Notifications.findMany>[0],
        userId?: string,
    ): Promise<Notification[]> {
        const found = await db.query.Notifications.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: {
                ...extra?.with,
                account: {
                    with: {
                        ...userRelations,
                    },
                    extras: userExtrasTemplate("Notifications_account"),
                },
            },
            extras: extra?.extras,
        });

        return (
            await Promise.all(
                found.map(async (notif) => ({
                    ...notif,
                    account: transformOutputToUserWithRelations(notif.account),
                    status:
                        (await Note.fromId(notif.noteId, userId))?.data ?? null,
                })),
            )
        ).map((s) => new Notification(s));
    }

    public async update(
        newAttachment: Partial<NotificationType>,
    ): Promise<NotificationType> {
        await db
            .update(Notifications)
            .set(newAttachment)
            .where(eq(Notifications.id, this.id));

        const updated = await Notification.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update notification");
        }

        this.data = updated.data;
        return updated.data;
    }

    public save(): Promise<NotificationType> {
        return this.update(this.data);
    }

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db
                .delete(Notifications)
                .where(inArray(Notifications.id, ids));
        } else {
            await db.delete(Notifications).where(eq(Notifications.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof Notifications>,
    ): Promise<Notification> {
        const inserted = (
            await db.insert(Notifications).values(data).returning()
        )[0];

        const notification = await Notification.fromId(inserted.id);

        if (!notification) {
            throw new Error("Failed to insert notification");
        }

        return notification;
    }

    public get id(): string {
        return this.data.id;
    }

    public async toApi(): Promise<APINotification> {
        const account = new User(this.data.account);

        return {
            account: account.toApi(),
            created_at: new Date(this.data.createdAt).toISOString(),
            id: this.data.id,
            type: this.data.type,
            status: this.data.status
                ? await new Note(this.data.status).toApi(account)
                : undefined,
        };
    }
}
