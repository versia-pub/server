import { Notes, Notifications, Users } from "@versia/kit/tables";
import { type SQL, gt } from "drizzle-orm";
import { config } from "~/config.ts";
import { Note } from "./note.ts";
import { Notification } from "./notification.ts";
import { User } from "./user.ts";

enum TimelineType {
    Note = "Note",
    User = "User",
    Notification = "Notification",
}

export class Timeline<Type extends Note | User | Notification> {
    public constructor(private type: TimelineType) {}

    public static getNoteTimeline(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: URL,
        userId?: string,
    ): Promise<{ link: string; objects: Note[] }> {
        return new Timeline<Note>(TimelineType.Note).fetchTimeline(
            sql,
            limit,
            url,
            userId,
        );
    }

    public static getUserTimeline(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: URL,
    ): Promise<{ link: string; objects: User[] }> {
        return new Timeline<User>(TimelineType.User).fetchTimeline(
            sql,
            limit,
            url,
        );
    }

    public static getNotificationTimeline(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: URL,
        userId?: string,
    ): Promise<{ link: string; objects: Notification[] }> {
        return new Timeline<Notification>(
            TimelineType.Notification,
        ).fetchTimeline(sql, limit, url, userId);
    }

    private async fetchObjects(
        sql: SQL<unknown> | undefined,
        limit: number,
        userId?: string,
    ): Promise<Type[]> {
        switch (this.type) {
            case TimelineType.Note:
                return (await Note.manyFromSql(
                    sql,
                    undefined,
                    limit,
                    undefined,
                    userId,
                )) as Type[];
            case TimelineType.User:
                return (await User.manyFromSql(
                    sql,
                    undefined,
                    limit,
                )) as Type[];
            case TimelineType.Notification:
                return (await Notification.manyFromSql(
                    sql,
                    undefined,
                    limit,
                    undefined,
                    undefined,
                    userId,
                )) as Type[];
        }
    }

    private async fetchLinkHeader(
        objects: Type[],
        url: URL,
        limit: number,
    ): Promise<string> {
        const linkHeader: string[] = [];
        const urlWithoutQuery = new URL(url.pathname, config.http.base_url);

        if (objects.length > 0) {
            switch (this.type) {
                case TimelineType.Note:
                    linkHeader.push(
                        ...(await Timeline.fetchNoteLinkHeader(
                            objects as Note[],
                            urlWithoutQuery,
                            limit,
                        )),
                    );
                    break;
                case TimelineType.User:
                    linkHeader.push(
                        ...(await Timeline.fetchUserLinkHeader(
                            objects as User[],
                            urlWithoutQuery,
                            limit,
                        )),
                    );
                    break;
                case TimelineType.Notification:
                    linkHeader.push(
                        ...(await Timeline.fetchNotificationLinkHeader(
                            objects as Notification[],
                            urlWithoutQuery,
                            limit,
                        )),
                    );
            }
        }

        return linkHeader.join(", ");
    }

    private static async fetchNoteLinkHeader(
        notes: Note[],
        urlWithoutQuery: URL,
        limit: number,
    ): Promise<string[]> {
        const linkHeader: string[] = [];

        const objectBefore = await Note.fromSql(gt(Notes.id, notes[0].data.id));
        if (objectBefore) {
            linkHeader.push(
                `<${urlWithoutQuery}?limit=${limit ?? 20}&min_id=${notes[0].data.id}>; rel="prev"`,
            );
        }

        if (notes.length >= (limit ?? 20)) {
            const objectAfter = await Note.fromSql(
                gt(Notes.id, notes[notes.length - 1].data.id),
            );
            if (objectAfter) {
                linkHeader.push(
                    `<${urlWithoutQuery}?limit=${limit ?? 20}&max_id=${notes[notes.length - 1].data.id}>; rel="next"`,
                );
            }
        }

        return linkHeader;
    }

    private static async fetchUserLinkHeader(
        users: User[],
        urlWithoutQuery: URL,
        limit: number,
    ): Promise<string[]> {
        const linkHeader: string[] = [];

        const objectBefore = await User.fromSql(gt(Users.id, users[0].id));
        if (objectBefore) {
            linkHeader.push(
                `<${urlWithoutQuery}?limit=${limit ?? 20}&min_id=${users[0].id}>; rel="prev"`,
            );
        }

        if (users.length >= (limit ?? 20)) {
            const objectAfter = await User.fromSql(
                gt(Users.id, users[users.length - 1].id),
            );
            if (objectAfter) {
                linkHeader.push(
                    `<${urlWithoutQuery}?limit=${limit ?? 20}&max_id=${users[users.length - 1].id}>; rel="next"`,
                );
            }
        }

        return linkHeader;
    }

    private static async fetchNotificationLinkHeader(
        notifications: Notification[],
        urlWithoutQuery: URL,
        limit: number,
    ): Promise<string[]> {
        const linkHeader: string[] = [];

        const objectBefore = await Notification.fromSql(
            gt(Notifications.id, notifications[0].data.id),
        );
        if (objectBefore) {
            linkHeader.push(
                `<${urlWithoutQuery}?limit=${limit ?? 20}&min_id=${notifications[0].data.id}>; rel="prev"`,
            );
        }

        if (notifications.length >= (limit ?? 20)) {
            const objectAfter = await Notification.fromSql(
                gt(
                    Notifications.id,
                    notifications[notifications.length - 1].data.id,
                ),
            );
            if (objectAfter) {
                linkHeader.push(
                    `<${urlWithoutQuery}?limit=${limit ?? 20}&max_id=${notifications[notifications.length - 1].data.id}>; rel="next"`,
                );
            }
        }

        return linkHeader;
    }

    private async fetchTimeline(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: URL,
        userId?: string,
    ): Promise<{ link: string; objects: Type[] }> {
        const objects = await this.fetchObjects(sql, limit, userId);
        const link = await this.fetchLinkHeader(objects, url, limit);

        switch (this.type) {
            case TimelineType.Note:
                return {
                    link,
                    objects,
                };
            case TimelineType.User:
                return {
                    link,
                    objects,
                };
            case TimelineType.Notification:
                return {
                    link,
                    objects,
                };
        }
    }
}
