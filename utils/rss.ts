import { and, eq, inArray } from "drizzle-orm";
import { Feed } from "feed";
import { Note } from "~/classes/database/note";
import type { User } from "~/classes/database/user";
import { config } from "~/config";
import { Notes } from "~/drizzle/schema";

export const getFeed = async (user: User, page = 0): Promise<Feed> => {
    const notes = await Note.manyFromSql(
        and(
            eq(Notes.authorId, user.id),
            // Visibility check
            inArray(Notes.visibility, ["public", "unlisted"]),
        ),
        undefined,
        20,
        page * 20,
    );

    const feed = new Feed({
        link: new URL(
            `/api/v1/accounts/${user.id}/feed.rss`,
            config.http.base_url,
        ).href,
        id: new URL(
            `/api/v1/accounts/${user.id}/feed.rss`,
            config.http.base_url,
        ).href,
        language: user.data.source?.language || undefined,
        image: user.getAvatarUrl().href,
        copyright: `All rights reserved ${new Date().getFullYear()} @${user.data.username}`,
        feedLinks: {
            atom: new URL(
                `/api/v1/accounts/${user.id}/feed.atom`,
                config.http.base_url,
            ).href,
            rss: new URL(
                `/api/v1/accounts/${user.id}/feed.rss`,
                config.http.base_url,
            ).href,
        },
        author: {
            name: user.data.displayName || user.data.username,
            link: new URL(`/@${user.data.username}`, config.http.base_url).href,
        },
        description: `Public statuses posted by @${user.data.username}`,
        title: user.data.displayName || user.data.username,
    });

    for (const note of notes) {
        feed.addItem({
            link: new URL(
                `/@${user.data.username}/${note.id}`,
                config.http.base_url,
            ).href,
            content: note.data.content,
            date: new Date(note.data.createdAt),
            id: new URL(
                `/@${user.data.username}/${note.id}`,
                config.http.base_url,
            ).href,
            published: new Date(note.data.createdAt),
            title: "",
        });
    }

    return feed;
};
