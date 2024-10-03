import { type SQL, gt } from "drizzle-orm";
import { Notes, Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Note } from "./note";
import { User } from "./user";

enum TimelineType {
    Note = "Note",
    User = "User",
}

export class Timeline<Type extends Note | User> {
    constructor(private type: TimelineType) {}

    static getNoteTimeline(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: string,
        userId?: string,
    ) {
        return new Timeline<Note>(TimelineType.Note).fetchTimeline(
            sql,
            limit,
            url,
            userId,
        );
    }

    static getUserTimeline(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: string,
    ) {
        return new Timeline<User>(TimelineType.User).fetchTimeline(
            sql,
            limit,
            url,
        );
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
        }
    }

    private async fetchLinkHeader(
        objects: Type[],
        url: string,
        limit: number,
    ): Promise<string> {
        const linkHeader: string[] = [];
        const urlWithoutQuery = new URL(
            new URL(url).pathname,
            config.http.base_url,
        ).toString();

        if (objects.length > 0) {
            switch (this.type) {
                case TimelineType.Note:
                    linkHeader.push(
                        ...(await this.fetchNoteLinkHeader(
                            objects as Note[],
                            urlWithoutQuery,
                            limit,
                        )),
                    );
                    break;
                case TimelineType.User:
                    linkHeader.push(
                        ...(await this.fetchUserLinkHeader(
                            objects as User[],
                            urlWithoutQuery,
                            limit,
                        )),
                    );
                    break;
            }
        }

        return linkHeader.join(", ");
    }

    private async fetchNoteLinkHeader(
        notes: Note[],
        urlWithoutQuery: string,
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

    private async fetchUserLinkHeader(
        users: User[],
        urlWithoutQuery: string,
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

    private async fetchTimeline(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: string,
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
        }
    }

    /* private async fetchTimeline<T>(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: string,
        userId?: string,
    ) {
        const notes: Note[] = [];
        const users: User[] = [];

        switch (this.type) {
            case TimelineType.Note:
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
            case TimelineType.User:
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
                case TimelineType.Note: {
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
                case TimelineType.User: {
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
            case TimelineType.Note:
                return {
                    link: linkHeader.join(", "),
                    objects: notes as T[],
                };
            case TimelineType.User:
                return {
                    link: linkHeader.join(", "),
                    objects: users as T[],
                };
        }
    } */
}
