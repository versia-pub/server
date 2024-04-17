import { type SQL, gt } from "drizzle-orm";
import { status } from "~drizzle/schema";
import { config } from "~packages/config-manager";
import { Note } from "./note";

enum TimelineType {
    NOTE = "Note",
}

export class Timeline {
    constructor(private type: TimelineType) {}

    static async getNoteTimeline(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: string,
    ) {
        return new Timeline(TimelineType.NOTE).fetchTimeline(sql, limit, url);
    }

    private async fetchTimeline<T>(
        sql: SQL<unknown> | undefined,
        limit: number,
        url: string,
    ) {
        const objects: Note[] = [];

        switch (this.type) {
            case TimelineType.NOTE:
                objects.push(
                    ...(await Note.manyFromSql(sql, undefined, limit)),
                );
                break;
        }

        const linkHeader = [];
        const urlWithoutQuery = new URL(
            new URL(url).pathname,
            config.http.base_url,
        ).toString();

        if (objects.length > 0) {
            switch (this.type) {
                case TimelineType.NOTE: {
                    const objectBefore = await Note.fromSql(
                        gt(status.id, objects[0].getStatus().id),
                    );

                    if (objectBefore) {
                        linkHeader.push(
                            `<${urlWithoutQuery}?limit=${limit ?? 20}&min_id=${
                                objects[0].getStatus().id
                            }>; rel="prev"`,
                        );
                    }

                    if (objects.length >= (limit ?? 20)) {
                        const objectAfter = await Note.fromSql(
                            gt(
                                status.id,
                                objects[objects.length - 1].getStatus().id,
                            ),
                        );

                        if (objectAfter) {
                            linkHeader.push(
                                `<${urlWithoutQuery}?limit=${
                                    limit ?? 20
                                }&max_id=${
                                    objects[objects.length - 1].getStatus().id
                                }>; rel="next"`,
                            );
                        }
                    }
                    break;
                }
            }
        }

        return {
            link: linkHeader.join(", "),
            objects,
        };
    }
}
