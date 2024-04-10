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
import type { Note } from "~types/lysand/Object";
import type * as Lysand from "lysand-types";
import { applicationToAPI } from "./Application";
import { attachmentToAPI, attachmentToLysand } from "./Attachment";
import { emojiToAPI, emojiToLysand, parseEmojis } from "./Emoji";
import type { UserWithRelations } from "./User";
import { getUserUri, resolveUser, resolveWebFinger, userToAPI } from "./User";
import { statusAndUserRelations, userRelations } from "./relations";
import { objectToInboxRequest } from "./Federation";

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

export const resolveStatus = async (
    uri?: string,
    providedNote?: Lysand.Note,
): Promise<StatusWithRelations> => {
    if (!uri && !providedNote) {
        throw new Error("No URI or note provided");
    }

    // Check if status not already in database
    const foundStatus = await client.status.findUnique({
        where: {
            uri: uri ?? providedNote?.uri,
        },
        include: statusAndUserRelations,
    });

    if (foundStatus) return foundStatus;

    let note: Lysand.Note | null = providedNote ?? null;

    if (uri) {
        if (!URL.canParse(uri)) {
            throw new Error(`Invalid URI to parse ${uri}`);
        }

        const response = await fetch(uri, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        });

        note = (await response.json()) as Lysand.Note;
    }

    if (!note) {
        throw new Error("No note was able to be fetched");
    }

    if (note.type !== "Note") {
        throw new Error("Invalid object type");
    }

    if (!note.author) {
        throw new Error("Invalid object author");
    }

    const author = await resolveUser(note.author);

    if (!author) {
        throw new Error("Invalid object author");
    }

    return await createNewStatus(
        author,
        note.content ?? {
            "text/plain": {
                content: "",
            },
        },
        note.visibility as APIStatus["visibility"],
        note.is_sensitive ?? false,
        note.subject ?? "",
        [],
        note.uri,
        await Promise.all(
            (note.mentions ?? [])
                .map((mention) => resolveUser(mention))
                .filter(
                    (mention) => mention !== null,
                ) as Promise<UserWithRelations>[],
        ),
        // TODO: Add attachments
        [],
        note.replies_to ? await resolveStatus(note.replies_to) : undefined,
        note.quotes ? await resolveStatus(note.quotes) : undefined,
    );
};

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
        text.match(/@[a-zA-Z0-9_]+(@[a-zA-Z0-9_.:]+)?/g) ?? [];

    const found = await client.user.findMany({
        where: {
            OR: mentionedPeople.map((person) => ({
                username: person.split("@")[1],
                instance:
                    person.split("@").length > 2
                        ? {
                              base_url: person.split("@")[2],
                          }
                        : null,
            })),
        },
        include: userRelations,
    });

    const notFound = mentionedPeople.filter(
        (person) =>
            !found.find(
                (user) =>
                    user.username === person.split("@")[1] &&
                    user.instance?.base_url === person.split("@")[2],
            ),
    );

    // Attempt to resolve mentions that were not found
    for (const person of notFound) {
        const user = await resolveWebFinger(
            person.split("@")[1],
            person.split("@")[2],
        );

        if (user) {
            found.push(user);
        }
    }

    return found;
};

export const replaceTextMentions = async (
    text: string,
    mentions: UserWithRelations[],
) => {
    let finalText = text;
    for (const mention of mentions) {
        // Replace @username and @username@domain
        if (mention.instanceId) {
            finalText = finalText.replace(
                `@${mention.username}@${mention.instance?.base_url}`,
                `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${getUserUri(
                    mention,
                )}">@${mention.username}@${mention.instance?.base_url}</a>`,
            );
        } else {
            finalText = finalText.replace(
                `@${mention.username}`,
                `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${getUserUri(
                    mention,
                )}">@${mention.username}</a>`,
            );
        }
    }

    return finalText;
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
        // Split by newline and add <p> tags
        htmlContent = content["text/plain"].content
            .split("\n")
            .map((line) => `<p>${line}</p>`)
            .join("\n");

        htmlContent = linkifyHtml(htmlContent, {
            defaultProtocol: "https",
            validate: {
                email: () => false,
            },
            target: "_blank",
            rel: "nofollow noopener noreferrer",
        });
    } else {
        htmlContent = "";
    }

    // Replace mentions text
    htmlContent = await replaceTextMentions(htmlContent, mentions ?? []);

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
        const request = await objectToInboxRequest(
            statusToLysand(status),
            status.author,
            user,
        );

        // Send request
        const response = await fetch(request);

        if (!response.ok) {
            console.error(await response.text());
            throw new Error(
                `Failed to federate status ${status.id} to ${user.uri}`,
            );
        }
    }
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

export const getStatusUri = (status?: Status | null) => {
    if (!status) return undefined;

    return (
        status.uri ||
        new URL(`/objects/note/${status.id}`, config.http.base_url).toString()
    );
};

export const statusToLysand = (status: StatusWithRelations): Lysand.Note => {
    return {
        type: "Note",
        created_at: new Date(status.createdAt).toISOString(),
        id: status.id,
        author: getUserUri(status.author),
        uri: getStatusUri(status) ?? "",
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
        quotes: getStatusUri(status.quotingPost) ?? undefined,
        replies_to: getStatusUri(status.inReplyToPost) ?? undefined,
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
