import { type SQL, gt } from "drizzle-orm";
import { Notes, Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Note } from "./note";
import { User } from "./user";

enum TimelineType {
    NOTE = "Note",
    USER = "User",
}

export class Timeline {
    constructor(private type: TimelineType) {}

    static async getNoteTimeline(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: string,
        userId?: string,
    ) {
        return new Timeline(TimelineType.NOTE).fetchTimeline<Note>(
            sql,
            limit,
            url,
            userId,
        );
    }

    static async getUserTimeline(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: string,
    ) {
        return new Timeline(TimelineType.USER).fetchTimeline<User>(
            sql,
            limit,
            url,
        );
    }

    private async fetchTimeline<T>(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: string,
        userId?: string,
    ) {
        const notes: Note[] = [];
        const users: User[] = [];

        switch (this.type) {
            case TimelineType.NOTE:
                notes.push(
                    ...(await Note.manyFromSql(
                        sql,
                        undefined,
                        limit,
                        undefined,
                        userId,
                    )),
                );
                break;
            case TimelineType.USER:
                users.push(...(await User.manyFromSql(sql, undefined, limit)));
                break;
        }

        const linkHeader = [];
        const urlWithoutQuery = new URL(
            new URL(url).pathname,
            config.http.base_url,
        ).toString();

        if (notes.length > 0) {
            switch (this.type) {
                case TimelineType.NOTE: {
                    const objectBefore = await Note.fromSql(
                        gt(Notes.id, notes[0].data.id),
                    );

                    if (objectBefore) {
                        linkHeader.push(
                            `<${urlWithoutQuery}?limit=${limit ?? 20}&min_id=${
                                notes[0].data.id
                            }>; rel="prev"`,
                        );
                    }

                    if (notes.length >= (limit ?? 20)) {
                        const objectAfter = await Note.fromSql(
                            gt(Notes.id, notes[notes.length - 1].data.id),
                        );

                        if (objectAfter) {
                            linkHeader.push(
                                `<${urlWithoutQuery}?limit=${
                                    limit ?? 20
                                }&max_id=${
                                    notes[notes.length - 1].data.id
                                }>; rel="next"`,
                            );
                        }
                    }
                    break;
                }
                case TimelineType.USER: {
                    const objectBefore = await User.fromSql(
                        gt(Users.id, users[0].id),
                    );

                    if (objectBefore) {
                        linkHeader.push(
                            `<${urlWithoutQuery}?limit=${limit ?? 20}&min_id=${
                                users[0].id
                            }>; rel="prev"`,
                        );
                    }

                    if (users.length >= (limit ?? 20)) {
                        const objectAfter = await User.fromSql(
                            gt(Users.id, users[users.length - 1].id),
                        );

                        if (objectAfter) {
                            linkHeader.push(
                                `<${urlWithoutQuery}?limit=${
                                    limit ?? 20
                                }&max_id=${
                                    users[users.length - 1].id
                                }>; rel="next"`,
                            );
                        }
                    }
                    break;
                }
            }
        }

        switch (this.type) {
            case TimelineType.NOTE:
                return {
                    link: linkHeader.join(", "),
                    objects: notes as T[],
                };
            case TimelineType.USER:
                return {
                    link: linkHeader.join(", "),
                    objects: users as T[],
                };
        }
    }
}
