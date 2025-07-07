import type { Notification as NotificationSchema } from "@versia/client/schemas";
import {
    desc,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
    type SQL,
} from "drizzle-orm";
import type { z } from "zod/v4";
import { db } from "../tables/db.ts";
import { Notifications } from "../tables/schema.ts";
import { BaseInterface } from "./base.ts";
import { Note } from "./note.ts";
import {
    transformOutputToUserWithRelations,
    User,
    userRelations,
} from "./user.ts";

export type NotificationType = InferSelectModel<typeof Notifications> & {
    status: typeof Note.$type | null;
    account: typeof User.$type;
};

export class Notification extends BaseInterface<
    typeof Notifications,
    NotificationType
> {
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

    public async toApi(): Promise<z.infer<typeof NotificationSchema>> {
        const account = new User(this.data.account);

        return {
            account: account.toApi(),
            created_at: new Date(this.data.createdAt).toISOString(),
            id: this.data.id,
            type: this.data.type,
            event: undefined,
            status: this.data.status
                ? await new Note(this.data.status).toApi(account)
                : undefined,
            group_key: `ungrouped-${this.data.id}`,
        };
    }
}
