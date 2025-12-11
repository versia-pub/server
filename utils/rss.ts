import { config } from "@versia-server/config";
import { Media, Note, type User } from "@versia-server/kit/db";
import { Notes } from "@versia-server/kit/tables";
import { and, eq, inArray } from "drizzle-orm";
import { Feed } from "feed";

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
        const attachments = note.data.attachments.map((a) => new Media(a));
        const image = attachments.find((a) => a.getMastodonType() === "image");
        const video = attachments.find((a) => a.getMastodonType() === "video");
        const audio = attachments.find((a) => a.getMastodonType() === "audio");

        feed.addItem({
            link: new URL(
                `/@${user.data.username}/${note.id}`,
                config.http.base_url,
            ).href,
            content: note.data.content,
            date: note.data.createdAt,
            id: new URL(
                `/@${user.data.username}/${note.id}`,
                config.http.base_url,
            ).href,
            published: note.data.createdAt,
            title: "",
            image: image
                ? {
                      url: image.getUrl().href,
                      title:
                          image.data.content[image.getPreferredMimeType()]
                              ?.description ?? undefined,
                      type: image.getPreferredMimeType(),
                      length:
                          image.data.content[image.getPreferredMimeType()]
                              ?.size ?? undefined,
                  }
                : undefined,
            video: video
                ? {
                      url: video.getUrl().href,
                      title:
                          video.data.content[video.getPreferredMimeType()]
                              ?.description ?? undefined,
                      type: video.getPreferredMimeType(),
                      duration:
                          video.data.content[video.getPreferredMimeType()]
                              ?.duration ?? undefined,
                      length:
                          video.data.content[video.getPreferredMimeType()]
                              ?.size ?? undefined,
                  }
                : undefined,
            audio: audio
                ? {
                      url: audio.getUrl().href,
                      title:
                          audio.data.content[audio.getPreferredMimeType()]
                              ?.description ?? undefined,
                      type: audio.getPreferredMimeType(),
                      duration:
                          audio.data.content[audio.getPreferredMimeType()]
                              ?.duration ?? undefined,
                      length:
                          audio.data.content[audio.getPreferredMimeType()]
                              ?.size ?? undefined,
                  }
                : undefined,
        });
    }

    return feed;
};
