import { getBestContentType } from "@content_types";
import { addStausToMeilisearch } from "@meilisearch";
import {
    type Application,
    type Emoji,
    Prisma,
    type Relationship,
    type Status,
    type User,
} from "@prisma/client";
import { sanitizeHtml } from "@sanitization";
import { config } from "config-manager";
import { htmlToText } from "html-to-text";
import linkifyHtml from "linkify-html";
import linkifyStr from "linkify-string";
import { parse } from "marked";
import { client } from "~database/datasource";
import type { APIAttachment } from "~types/entities/attachment";
import type { APIStatus } from "~types/entities/status";
import type { LysandPublication, Note } from "~types/lysand/Object";
import type * as Lysand from "lysand-types";
import { applicationToAPI } from "./Application";
import { attachmentToAPI, attachmentToLysand } from "./Attachment";
import { emojiToAPI, emojiToLysand, parseEmojis } from "./Emoji";
import type { UserWithRelations } from "./User";
import { resolveUser, parseMentionsUris, userToAPI } from "./User";
import { statusAndUserRelations, userRelations } from "./relations";

const statusRelations = Prisma.validator<Prisma.StatusDefaultArgs>()({
    include: statusAndUserRelations,
});

export type StatusWithRelations = Prisma.StatusGetPayload<
    typeof statusRelations
>;

/**
 * Represents a status (i.e. a post)
 */

/**
 * Returns whether this status is viewable by a user.
 * @param user The user to check.
 * @returns Whether this status is viewable by the user.
 */
export const isViewableByUser = (status: Status, user: User | null) => {
    if (status.authorId === user?.id) return true;
    if (status.visibility === "public") return true;
    if (status.visibility === "unlisted") return true;
    if (status.visibility === "private") {
        // @ts-expect-error Prisma TypeScript types dont include relations
        return !!(user?.relationships as Relationship[]).find(
            (rel) => rel.id === status.authorId,
        );
    }
    // @ts-expect-error Prisma TypeScript types dont include relations
    return user && (status.mentions as User[]).includes(user);
};

export const fetchFromRemote = async (
    uri: string,
): Promise<StatusWithRelations | null> => {};

/**
 * Return all the ancestors of this post,
 */
export const getAncestors = async (
    status: StatusWithRelations,
    fetcher: UserWithRelations | null,
) => {
    const ancestors: StatusWithRelations[] = [];

    let currentStatus = status;

    while (currentStatus.inReplyToPostId) {
        const parent = await client.status.findFirst({
            where: {
                id: currentStatus.inReplyToPostId,
            },
            include: statusAndUserRelations,
        });

        if (!parent) break;

        ancestors.push(parent);

        currentStatus = parent;
    }

    // Filter for posts that are viewable by the user

    const viewableAncestors = ancestors.filter((ancestor) =>
        isViewableByUser(ancestor, fetcher),
    );
    return viewableAncestors;
};

/**
 * Return all the descendants of this post (recursive)
 * Temporary implementation, will be replaced with a recursive SQL query when Prisma adds support for it
 */
export const getDescendants = async (
    status: StatusWithRelations,
    fetcher: UserWithRelations | null,
    depth = 0,
) => {
    const descendants: StatusWithRelations[] = [];

    const currentStatus = status;

    // Fetch all children of children of children recursively calling getDescendants

    const children = await client.status.findMany({
        where: {
            inReplyToPostId: currentStatus.id,
        },
        include: statusAndUserRelations,
    });

    for (const child of children) {
        descendants.push(child);

        if (depth < 20) {
            const childDescendants = await getDescendants(
                child,
                fetcher,
                depth + 1,
            );
            descendants.push(...childDescendants);
        }
    }

    // Filter for posts that are viewable by the user

    const viewableDescendants = descendants.filter((descendant) =>
        isViewableByUser(descendant, fetcher),
    );
    return viewableDescendants;
};

/**
 * Get people mentioned in the content (match @username or @username@domain.com mentions)
 * @param text The text to parse mentions from.
 * @returns An array of users mentioned in the text.
 */
export const parseTextMentions = async (text: string) => {
    const mentionedPeople =
        text.match(/@[a-zA-Z0-9_]+(@[a-zA-Z0-9_]+)?/g) ?? [];

    return await client.user.findMany({
        where: {
            OR: mentionedPeople.map((person) => ({
                username: person.split("@")[1],
                instance: {
                    base_url: person.split("@")[2],
                },
            })),
        },
        include: userRelations,
    });
};

/**
 * Creates a new status and saves it to the database.
 * @returns A promise that resolves with the new status.
 */
export const createNewStatus = async (
    author: User,
    content: Lysand.ContentFormat,
    visibility: APIStatus["visibility"],
    is_sensitive: boolean,
    spoiler_text: string,
    emojis: Emoji[],
    uri?: string,
    mentions?: UserWithRelations[],
    /** List of IDs of database Attachment objects */
    media_attachments?: string[],
    inReplyTo?: StatusWithRelations,
    quoting?: StatusWithRelations,
) => {
    let htmlContent: string;

    if (content["text/html"]) {
        htmlContent = content["text/html"].content;
    } else if (content["text/markdown"]) {
        htmlContent = linkifyHtml(
            await sanitizeHtml(await parse(content["text/markdown"].content)),
        );
    } else if (content["text/plain"]) {
        htmlContent = linkifyStr(content["text/plain"].content);

        // Split by newline and add <p> tags
        htmlContent = htmlContent
            .split("\n")
            .map((line) => `<p>${line}</p>`)
            .join("\n");
    } else {
        htmlContent = "";
    }

    // Parse emojis and fuse with existing emojis
    let foundEmojis = emojis;

    if (author.instanceId === null) {
        const parsedEmojis = await parseEmojis(htmlContent);
        // Fuse and deduplicate
        foundEmojis = [...emojis, ...parsedEmojis].filter(
            (emoji, index, self) =>
                index === self.findIndex((t) => t.id === emoji.id),
        );
    }

    const status = await client.status.create({
        data: {
            authorId: author.id,
            content: htmlContent,
            contentSource:
                content["text/plain"]?.content ||
                content["text/markdown"]?.content ||
                "",
            contentType: "text/html",
            visibility: visibility,
            sensitive: is_sensitive,
            spoilerText: spoiler_text,
            isReblog: false, // DEPRECATED FIELD
            emojis: {
                connect: foundEmojis.map((emoji) => {
                    return {
                        id: emoji.id,
                    };
                }),
            },
            attachments: media_attachments
                ? {
                      connect: media_attachments.map((attachment) => {
                          return {
                              id: attachment,
                          };
                      }),
                  }
                : undefined,
            inReplyToPostId: inReplyTo?.id,
            quotingPostId: quoting?.id,
            instanceId: author.instanceId || undefined,
            uri: uri || null,
            mentions: {
                connect: mentions?.map((mention) => {
                    return {
                        id: mention.id,
                    };
                }),
            },
        },
        include: statusAndUserRelations,
    });

    return status;
};

export const federateStatus = async (status: StatusWithRelations) => {
    const toFederateTo = await getUsersToFederateTo(status);

    for (const user of toFederateTo) {
        // TODO: Add queue system
        const request = await statusToInboxRequest(status, user);

        // Send request
        const response = await fetch(request);

        if (!response.ok) {
            throw new Error(
                `Failed to federate status ${status.id} to ${user.uri}`,
            );
        }
    }
};

export const statusToInboxRequest = async (
    status: StatusWithRelations,
    user: User,
): Promise<Request> => {
    const output = statusToLysand(status);

    if (!user.instanceId || !user.endpoints.inbox) {
        throw new Error("User has no inbox or is a local user");
    }

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        Uint8Array.from(atob(status.author.privateKey ?? ""), (c) =>
            c.charCodeAt(0),
        ),
        "Ed25519",
        false,
        ["sign"],
    );

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(output)),
    );

    const userInbox = new URL(user.endpoints.inbox);

    const date = new Date();

    const signature = await crypto.subtle.sign(
        "Ed25519",
        privateKey,
        new TextEncoder().encode(
            `(request-target): post ${userInbox.pathname}\n` +
                `host: ${userInbox.host}\n` +
                `date: ${date.toISOString()}\n` +
                `digest: SHA-256=${btoa(
                    String.fromCharCode(...new Uint8Array(digest)),
                )}\n`,
        ),
    );

    const signatureBase64 = btoa(
        String.fromCharCode(...new Uint8Array(signature)),
    );

    return new Request(userInbox, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Date: date.toISOString(),
            Origin: config.http.base_url,
            Signature: `keyId="${status.author.uri}",algorithm="ed25519",headers="(request-target) host date digest",signature="${signatureBase64}"`,
        },
        body: JSON.stringify(output),
    });
};

export const getUsersToFederateTo = async (status: StatusWithRelations) => {
    return await client.user.findMany({
        where: {
            OR: [
                ["public", "unlisted", "private"].includes(status.visibility)
                    ? {
                          relationships: {
                              some: {
                                  subjectId: status.authorId,
                                  following: true,
                              },
                          },
                          instanceId: {
                              not: null,
                          },
                      }
                    : {},
                // Mentioned users
                {
                    id: {
                        in: status.mentions.map((m) => m.id),
                    },
                    instanceId: {
                        not: null,
                    },
                },
            ],
        },
    });
};

export const editStatus = async (
    status: StatusWithRelations,
    data: {
        content: string;
        visibility?: APIStatus["visibility"];
        sensitive: boolean;
        spoiler_text: string;
        emojis?: Emoji[];
        content_type?: string;
        uri?: string;
        mentions?: User[];
        media_attachments?: string[];
    },
) => {
    // Get people mentioned in the content (match @username or @username@domain.com mentions
    const mentionedPeople =
        data.content.match(/@[a-zA-Z0-9_]+(@[a-zA-Z0-9_]+)?/g) ?? [];

    let mentions = data.mentions || [];

    // Parse emojis
    const emojis = await parseEmojis(data.content);

    data.emojis = data.emojis ? [...data.emojis, ...emojis] : emojis;

    // Get list of mentioned users
    if (mentions.length === 0) {
        mentions = await client.user.findMany({
            where: {
                OR: mentionedPeople.map((person) => ({
                    username: person.split("@")[1],
                    instance: {
                        base_url: person.split("@")[2],
                    },
                })),
            },
            include: userRelations,
        });
    }

    let formattedContent = "";

    // Get HTML version of content
    if (data.content_type === "text/markdown") {
        formattedContent = linkifyHtml(
            await sanitizeHtml(await parse(data.content)),
        );
    } else if (data.content_type === "text/x.misskeymarkdown") {
        // Parse as MFM
    } else {
        // Parse as plaintext
        formattedContent = linkifyStr(data.content);

        // Split by newline and add <p> tags
        formattedContent = formattedContent
            .split("\n")
            .map((line) => `<p>${line}</p>`)
            .join("\n");
    }

    const newStatus = await client.status.update({
        where: {
            id: status.id,
        },
        data: {
            content: formattedContent,
            contentSource: data.content,
            contentType: data.content_type,
            visibility: data.visibility,
            sensitive: data.sensitive,
            spoilerText: data.spoiler_text,
            emojis: {
                connect: data.emojis.map((emoji) => {
                    return {
                        id: emoji.id,
                    };
                }),
            },
            attachments: data.media_attachments
                ? {
                      connect: data.media_attachments.map((attachment) => {
                          return {
                              id: attachment,
                          };
                      }),
                  }
                : undefined,
            mentions: {
                connect: mentions.map((mention) => {
                    return {
                        id: mention.id,
                    };
                }),
            },
        },
        include: statusAndUserRelations,
    });

    return newStatus;
};

export const isFavouritedBy = async (status: Status, user: User) => {
    return !!(await client.like.findFirst({
        where: {
            likerId: user.id,
            likedId: status.id,
        },
    }));
};

/**
 * Converts this status to an API status.
 * @returns A promise that resolves with the API status.
 */
export const statusToAPI = async (
    status: StatusWithRelations,
    user?: UserWithRelations,
): Promise<APIStatus> => {
    return {
        id: status.id,
        in_reply_to_id: status.inReplyToPostId || null,
        in_reply_to_account_id: status.inReplyToPost?.authorId || null,
        // @ts-expect-error Prisma TypeScript types dont include relations
        account: userToAPI(status.author),
        created_at: new Date(status.createdAt).toISOString(),
        application: status.application
            ? applicationToAPI(status.application)
            : null,
        card: null,
        content: status.content,
        emojis: status.emojis.map((emoji) => emojiToAPI(emoji)),
        favourited: !!(status.likes ?? []).find(
            (like) => like.likerId === user?.id,
        ),
        favourites_count: (status.likes ?? []).length,
        media_attachments: (status.attachments ?? []).map(
            (a) => attachmentToAPI(a) as APIAttachment,
        ),
        // @ts-expect-error Prisma TypeScript types dont include relations
        mentions: status.mentions.map((mention) => userToAPI(mention)),
        language: null,
        muted: user
            ? user.relationships.find((r) => r.subjectId === status.authorId)
                  ?.muting || false
            : false,
        pinned: status.pinnedBy.find((u) => u.id === user?.id) ? true : false,
        // TODO: Add polls
        poll: null,
        reblog: status.reblog
            ? await statusToAPI(status.reblog as unknown as StatusWithRelations)
            : null,
        reblogged: !!(await client.status.findFirst({
            where: {
                authorId: user?.id,
                reblogId: status.id,
            },
        })),
        reblogs_count: status._count.reblogs,
        replies_count: status._count.replies,
        sensitive: status.sensitive,
        spoiler_text: status.spoilerText,
        tags: [],
        uri:
            status.uri ||
            new URL(
                `/@${status.author.username}/${status.id}`,
                config.http.base_url,
            ).toString(),
        visibility: "public",
        url:
            status.uri ||
            new URL(
                `/@${status.author.username}/${status.id}`,
                config.http.base_url,
            ).toString(),
        bookmarked: false,
        quote: status.quotingPost
            ? await statusToAPI(
                  status.quotingPost as unknown as StatusWithRelations,
              )
            : null,
        quote_id: status.quotingPost?.id || undefined,
    };
};

export const statusToLysand = (status: StatusWithRelations): Lysand.Note => {
    return {
        type: "Note",
        created_at: new Date(status.createdAt).toISOString(),
        id: status.id,
        author:
            status.author.uri ||
            new URL(
                `/users/${status.author.id}`,
                config.http.base_url,
            ).toString(),
        uri:
            status.uri ||
            new URL(
                `/objects/note/${status.id}`,
                config.http.base_url,
            ).toString(),
        content: {
            "text/html": {
                content: status.content,
            },
            "text/plain": {
                content: htmlToText(status.content),
            },
        },
        attachments: status.attachments.map((attachment) =>
            attachmentToLysand(attachment),
        ),
        is_sensitive: status.sensitive,
        mentions: status.mentions.map((mention) => mention.uri || ""),
        quotes: status.quotingPost?.uri ?? undefined,
        replies_to: status.inReplyToPost?.uri ?? undefined,
        subject: status.spoilerText,
        visibility: status.visibility as Lysand.Visibility,
        extensions: {
            "org.lysand:custom_emojis": {
                emojis: status.emojis.map((emoji) => emojiToLysand(emoji)),
            },
            // TODO: Add polls and reactions
        },
    };
};
