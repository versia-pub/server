import { dualLogger } from "@loggers";
import { sanitizeHtml } from "@sanitization";
import { config } from "config-manager";
import {
    type InferSelectModel,
    and,
    eq,
    inArray,
    isNull,
    or,
    sql,
} from "drizzle-orm";
import { htmlToText } from "html-to-text";
import linkifyHtml from "linkify-html";
import type * as Lysand from "lysand-types";
import {
    anyOf,
    charIn,
    createRegExp,
    digit,
    exactly,
    global,
    letter,
    maybe,
    oneOrMore,
} from "magic-regexp";
import { parse } from "marked";
import { db } from "~drizzle/db";
import {
    type application,
    attachment,
    emojiToStatus,
    instance,
    type like,
    status,
    statusToMentions,
    user,
} from "~drizzle/schema";
import { LogLevel } from "~packages/log-manager";
import type { Note } from "~types/lysand/Object";
import type { Attachment as APIAttachment } from "~types/mastodon/attachment";
import type { Status as APIStatus } from "~types/mastodon/status";
import { applicationToAPI, type Application } from "./Application";
import {
    attachmentFromLysand,
    attachmentToAPI,
    attachmentToLysand,
} from "./Attachment";
import {
    type EmojiWithInstance,
    emojiToAPI,
    emojiToLysand,
    fetchEmoji,
    parseEmojis,
} from "./Emoji";
import { objectToInboxRequest } from "./Federation";
import {
    type User,
    type UserWithRelations,
    type UserWithRelationsAndRelationships,
    findManyUsers,
    getUserUri,
    resolveUser,
    resolveWebFinger,
    transformOutputToUserWithRelations,
    userExtrasTemplate,
    userRelations,
    userToAPI,
} from "./User";

export type Status = InferSelectModel<typeof status>;

export type StatusWithRelations = Status & {
    author: UserWithRelations;
    mentions: UserWithRelations[];
    attachments: InferSelectModel<typeof attachment>[];
    reblog: StatusWithoutRecursiveRelations | null;
    emojis: EmojiWithInstance[];
    likes: InferSelectModel<typeof like>[];
    inReplyTo: StatusWithoutRecursiveRelations | null;
    quoting: StatusWithoutRecursiveRelations | null;
    application: InferSelectModel<typeof application> | null;
    reblogCount: number;
    likeCount: number;
    replyCount: number;
};

export type StatusWithoutRecursiveRelations = Omit<
    StatusWithRelations,
    | "inReplyTo"
    | "quoting"
    | "reblog"
    | "reblogCount"
    | "likeCount"
    | "replyCount"
>;

export const statusExtras = {
    reblogCount:
        sql`(SELECT COUNT(*) FROM "Status" "status" WHERE "status"."reblogId" = "status".id)`.as(
            "reblog_count",
        ),
    likeCount:
        sql`(SELECT COUNT(*) FROM "Like" "like" WHERE "like"."likedId" = "status".id)`.as(
            "like_count",
        ),
    replyCount:
        sql`(SELECT COUNT(*) FROM "Status" "status" WHERE "status"."inReplyToPostId" = "status".id)`.as(
            "reply_count",
        ),
};

export const statusExtrasTemplate = (name: string) => ({
    // @ts-ignore
    reblogCount: sql([
        `(SELECT COUNT(*) FROM "Status" "status" WHERE "status"."reblogId" = ${name}.id)`,
    ]).as("reblog_count"),
    // @ts-ignore
    likeCount: sql([
        `(SELECT COUNT(*) FROM "Like" "like" WHERE "like"."likedId" = ${name}.id)`,
    ]).as("like_count"),
    // @ts-ignore
    replyCount: sql([
        `(SELECT COUNT(*) FROM "Status" "status" WHERE "status"."inReplyToPostId" = ${name}.id)`,
    ]).as("reply_count"),
});

/**
 * Returns whether this status is viewable by a user.
 * @param user The user to check.
 * @returns Whether this status is viewable by the user.
 */
export const isViewableByUser = async (
    status: StatusWithRelations,
    user: UserWithRelations | null,
) => {
    if (status.authorId === user?.id) return true;
    if (status.visibility === "public") return true;
    if (status.visibility === "unlisted") return true;
    if (status.visibility === "private") {
        return user
            ? await db.query.relationship.findFirst({
                  where: (relationship, { and, eq }) =>
                      and(
                          eq(relationship.ownerId, user?.id),
                          eq(relationship.subjectId, status.authorId),
                          eq(relationship.following, true),
                      ),
              })
            : false;
    }
    return user && status.mentions.includes(user);
};

export const findManyStatuses = async (
    query: Parameters<typeof db.query.status.findMany>[0],
): Promise<StatusWithRelations[]> => {
    const output = await db.query.status.findMany({
        ...query,
        with: {
            ...query?.with,
            attachments: {
                where: (attachment, { eq }) =>
                    eq(attachment.statusId, sql`"status"."id"`),
            },
            emojis: {
                with: {
                    emoji: {
                        with: {
                            instance: true,
                        },
                    },
                },
            },
            author: {
                with: {
                    ...userRelations,
                },
                extras: userExtrasTemplate("status_author"),
            },
            mentions: {
                with: {
                    user: {
                        with: userRelations,
                        extras: userExtrasTemplate("status_mentions_user"),
                    },
                },
            },
            reblog: {
                with: {
                    attachments: true,
                    emojis: {
                        with: {
                            emoji: {
                                with: {
                                    instance: true,
                                },
                            },
                        },
                    },
                    likes: true,
                    application: true,
                    mentions: {
                        with: {
                            user: {
                                with: userRelations,
                                extras: userExtrasTemplate(
                                    "status_reblog_mentions_user",
                                ),
                            },
                        },
                    },
                    author: {
                        with: {
                            ...userRelations,
                        },
                        extras: userExtrasTemplate("status_reblog_author"),
                    },
                },
            },
            inReplyTo: {
                with: {
                    attachments: true,
                    emojis: {
                        with: {
                            emoji: {
                                with: {
                                    instance: true,
                                },
                            },
                        },
                    },
                    likes: true,
                    application: true,
                    mentions: {
                        with: {
                            user: {
                                with: userRelations,
                                extras: userExtrasTemplate(
                                    "status_inReplyTo_mentions_user",
                                ),
                            },
                        },
                    },
                    author: {
                        with: {
                            ...userRelations,
                        },
                        extras: userExtrasTemplate("status_inReplyTo_author"),
                    },
                },
            },
            quoting: {
                with: {
                    attachments: true,
                    emojis: {
                        with: {
                            emoji: {
                                with: {
                                    instance: true,
                                },
                            },
                        },
                    },
                    likes: true,
                    application: true,
                    mentions: {
                        with: {
                            user: {
                                with: userRelations,
                                extras: userExtrasTemplate(
                                    "status_quoting_mentions_user",
                                ),
                            },
                        },
                    },
                    author: {
                        with: {
                            ...userRelations,
                        },
                        extras: userExtrasTemplate("status_quoting_author"),
                    },
                },
            },
        },
        extras: {
            ...statusExtras,
            ...query?.extras,
        },
    });

    return output.map((post) => ({
        ...post,
        author: transformOutputToUserWithRelations(post.author),
        mentions: post.mentions.map(
            (mention) =>
                mention.user &&
                transformOutputToUserWithRelations(mention.user),
        ),
        reblog: post.reblog && {
            ...post.reblog,
            author: transformOutputToUserWithRelations(post.reblog.author),
            mentions: post.reblog.mentions.map(
                (mention) =>
                    mention.user &&
                    transformOutputToUserWithRelations(mention.user),
            ),
            emojis: post.reblog.emojis.map(
                (emoji) =>
                    (emoji as unknown as Record<string, object>)
                        .emoji as EmojiWithInstance,
            ),
        },
        inReplyTo: post.inReplyTo && {
            ...post.inReplyTo,
            author: transformOutputToUserWithRelations(post.inReplyTo.author),
            mentions: post.inReplyTo.mentions.map(
                (mention) =>
                    mention.user &&
                    transformOutputToUserWithRelations(mention.user),
            ),
            emojis: post.inReplyTo.emojis.map(
                (emoji) =>
                    (emoji as unknown as Record<string, object>)
                        .emoji as EmojiWithInstance,
            ),
        },
        quoting: post.quoting && {
            ...post.quoting,
            author: transformOutputToUserWithRelations(post.quoting.author),
            mentions: post.quoting.mentions.map(
                (mention) =>
                    mention.user &&
                    transformOutputToUserWithRelations(mention.user),
            ),
            emojis: post.quoting.emojis.map(
                (emoji) =>
                    (emoji as unknown as Record<string, object>)
                        .emoji as EmojiWithInstance,
            ),
        },
        emojis: (post.emojis ?? []).map(
            (emoji) =>
                (emoji as unknown as Record<string, object>)
                    .emoji as EmojiWithInstance,
        ),
        reblogCount: Number(post.reblogCount),
        likeCount: Number(post.likeCount),
        replyCount: Number(post.replyCount),
    }));
};

export const findFirstStatuses = async (
    query: Parameters<typeof db.query.status.findFirst>[0],
): Promise<StatusWithRelations | null> => {
    const output = await db.query.status.findFirst({
        ...query,
        with: {
            ...query?.with,
            attachments: {
                where: (attachment, { eq }) =>
                    eq(attachment.statusId, sql`"status"."id"`),
            },
            emojis: {
                with: {
                    emoji: {
                        with: {
                            instance: true,
                        },
                    },
                },
            },
            author: {
                with: {
                    ...userRelations,
                },
                extras: userExtrasTemplate("status_author"),
            },
            mentions: {
                with: {
                    user: {
                        with: userRelations,
                        extras: userExtrasTemplate("status_mentions_user"),
                    },
                },
            },
            reblog: {
                with: {
                    attachments: true,
                    emojis: {
                        with: {
                            emoji: {
                                with: {
                                    instance: true,
                                },
                            },
                        },
                    },
                    likes: true,
                    application: true,
                    mentions: {
                        with: {
                            user: {
                                with: userRelations,
                                extras: userExtrasTemplate(
                                    "status_reblog_mentions_user",
                                ),
                            },
                        },
                    },
                    author: {
                        with: {
                            ...userRelations,
                        },
                        extras: userExtrasTemplate("status_reblog_author"),
                    },
                },
            },
            inReplyTo: {
                with: {
                    attachments: true,
                    emojis: {
                        with: {
                            emoji: {
                                with: {
                                    instance: true,
                                },
                            },
                        },
                    },
                    likes: true,
                    application: true,
                    mentions: {
                        with: {
                            user: {
                                with: userRelations,
                                extras: userExtrasTemplate(
                                    "status_inReplyTo_mentions_user",
                                ),
                            },
                        },
                    },
                    author: {
                        with: {
                            ...userRelations,
                        },
                        extras: userExtrasTemplate("status_inReplyTo_author"),
                    },
                },
            },
            quoting: {
                with: {
                    attachments: true,
                    emojis: {
                        with: {
                            emoji: {
                                with: {
                                    instance: true,
                                },
                            },
                        },
                    },
                    likes: true,
                    application: true,
                    mentions: {
                        with: {
                            user: {
                                with: userRelations,
                                extras: userExtrasTemplate(
                                    "status_quoting_mentions_user",
                                ),
                            },
                        },
                    },
                    author: {
                        with: {
                            ...userRelations,
                        },
                        extras: userExtrasTemplate("status_quoting_author"),
                    },
                },
            },
        },
        extras: {
            ...statusExtras,
            ...query?.extras,
        },
    });

    if (!output) return null;

    return {
        ...output,
        author: transformOutputToUserWithRelations(output.author),
        mentions: output.mentions.map((mention) =>
            transformOutputToUserWithRelations(mention.user),
        ),
        reblog: output.reblog && {
            ...output.reblog,
            author: transformOutputToUserWithRelations(output.reblog.author),
            mentions: output.reblog.mentions.map(
                (mention) =>
                    mention.user &&
                    transformOutputToUserWithRelations(mention.user),
            ),
            emojis: output.reblog.emojis.map(
                (emoji) =>
                    (emoji as unknown as Record<string, object>)
                        .emoji as EmojiWithInstance,
            ),
        },
        inReplyTo: output.inReplyTo && {
            ...output.inReplyTo,
            author: transformOutputToUserWithRelations(output.inReplyTo.author),
            mentions: output.inReplyTo.mentions.map(
                (mention) =>
                    mention.user &&
                    transformOutputToUserWithRelations(mention.user),
            ),
            emojis: output.inReplyTo.emojis.map(
                (emoji) =>
                    (emoji as unknown as Record<string, object>)
                        .emoji as EmojiWithInstance,
            ),
        },
        quoting: output.quoting && {
            ...output.quoting,
            author: transformOutputToUserWithRelations(output.quoting.author),
            mentions: output.quoting.mentions.map(
                (mention) =>
                    mention.user &&
                    transformOutputToUserWithRelations(mention.user),
            ),
            emojis: output.quoting.emojis.map(
                (emoji) =>
                    (emoji as unknown as Record<string, object>)
                        .emoji as EmojiWithInstance,
            ),
        },
        emojis: (output.emojis ?? []).map(
            (emoji) =>
                (emoji as unknown as Record<string, object>)
                    .emoji as EmojiWithInstance,
        ),
        reblogCount: Number(output.reblogCount),
        likeCount: Number(output.likeCount),
        replyCount: Number(output.replyCount),
    };
};

export const resolveStatus = async (
    uri?: string,
    providedNote?: Lysand.Note,
): Promise<StatusWithRelations> => {
    if (!uri && !providedNote) {
        throw new Error("No URI or note provided");
    }

    const foundStatus = await findFirstStatuses({
        where: (status, { eq }) =>
            eq(status.uri, uri ?? providedNote?.uri ?? ""),
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

    const attachments = [];

    for (const attachment of note.attachments ?? []) {
        const resolvedAttachment = await attachmentFromLysand(attachment).catch(
            (e) => {
                dualLogger.logError(
                    LogLevel.ERROR,
                    "Federation.StatusResolver",
                    e,
                );
                return null;
            },
        );

        if (resolvedAttachment) {
            attachments.push(resolvedAttachment);
        }
    }

    const emojis = [];

    for (const emoji of note.extensions?.["org.lysand:custom_emojis"]?.emojis ??
        []) {
        const resolvedEmoji = await fetchEmoji(emoji).catch((e) => {
            dualLogger.logError(LogLevel.ERROR, "Federation.StatusResolver", e);
            return null;
        });

        if (resolvedEmoji) {
            emojis.push(resolvedEmoji);
        }
    }

    const createdStatus = await createNewStatus(
        author,
        note.content ?? {
            "text/plain": {
                content: "",
            },
        },
        note.visibility as APIStatus["visibility"],
        note.is_sensitive ?? false,
        note.subject ?? "",
        emojis,
        note.uri,
        await Promise.all(
            (note.mentions ?? [])
                .map((mention) => resolveUser(mention))
                .filter(
                    (mention) => mention !== null,
                ) as Promise<UserWithRelations>[],
        ),
        attachments.map((a) => a.id),
        note.replies_to ? await resolveStatus(note.replies_to) : undefined,
        note.quotes ? await resolveStatus(note.quotes) : undefined,
    );

    if (!createdStatus) {
        throw new Error("Failed to create status");
    }

    return createdStatus;
};

/**
 * Return all the ancestors of this post,
 */
export const getAncestors = async (
    status: StatusWithRelations,
    fetcher: UserWithRelationsAndRelationships | null,
) => {
    const ancestors: StatusWithRelations[] = [];

    let currentStatus = status;

    while (currentStatus.inReplyToPostId) {
        const parent = await findFirstStatuses({
            where: (status, { eq }) =>
                eq(status.id, currentStatus.inReplyToPostId ?? ""),
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
    fetcher: UserWithRelationsAndRelationships | null,
    depth = 0,
) => {
    const descendants: StatusWithRelations[] = [];

    const currentStatus = status;

    // Fetch all children of children of children recursively calling getDescendants

    const children = await findManyStatuses({
        where: (status, { eq }) => eq(status.inReplyToPostId, currentStatus.id),
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

export const createMentionRegExp = () =>
    createRegExp(
        exactly("@"),
        oneOrMore(anyOf(letter.lowercase, digit, charIn("-"))).groupedAs(
            "username",
        ),
        maybe(
            exactly("@"),
            oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
        ),
        [global],
    );

/**
 * Get people mentioned in the content (match @username or @username@domain.com mentions)
 * @param text The text to parse mentions from.
 * @returns An array of users mentioned in the text.
 */
export const parseTextMentions = async (
    text: string,
): Promise<UserWithRelations[]> => {
    const mentionedPeople = [...text.matchAll(createMentionRegExp())] ?? [];
    if (mentionedPeople.length === 0) return [];

    const baseUrlHost = new URL(config.http.base_url).host;

    const isLocal = (host?: string) => host === baseUrlHost || !host;

    const foundUsers = await db
        .select({
            id: user.id,
            username: user.username,
            baseUrl: instance.baseUrl,
        })
        .from(user)
        .leftJoin(instance, eq(user.instanceId, instance.id))
        .where(
            or(
                ...mentionedPeople.map((person) =>
                    and(
                        eq(user.username, person?.[1] ?? ""),
                        isLocal(person?.[2])
                            ? isNull(user.instanceId)
                            : eq(instance.baseUrl, person?.[2] ?? ""),
                    ),
                ),
            ),
        );

    const notFoundRemoteUsers = mentionedPeople.filter(
        (person) =>
            !isLocal(person?.[2]) &&
            !foundUsers.find(
                (user) =>
                    user.username === person?.[1] &&
                    user.baseUrl === person?.[2],
            ),
    );

    const finalList =
        foundUsers.length > 0
            ? await findManyUsers({
                  where: (user, { inArray }) =>
                      inArray(
                          user.id,
                          foundUsers.map((u) => u.id),
                      ),
              })
            : [];

    // Attempt to resolve mentions that were not found
    for (const person of notFoundRemoteUsers) {
        const user = await resolveWebFinger(
            person?.[1] ?? "",
            person?.[2] ?? "",
        );

        if (user) {
            finalList.push(user);
        }
    }

    return finalList;
};

export const replaceTextMentions = async (
    text: string,
    mentions: UserWithRelations[],
) => {
    let finalText = text;
    for (const mention of mentions) {
        // Replace @username and @username@domain
        if (mention.instance) {
            finalText = finalText.replace(
                createRegExp(
                    exactly(`@${mention.username}@${mention.instance.baseUrl}`),
                    [global],
                ),
                `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${getUserUri(
                    mention,
                )}">@${mention.username}@${mention.instance.baseUrl}</a>`,
            );
        } else {
            finalText = finalText.replace(
                // Only replace @username if it doesn't have another @ right after
                createRegExp(
                    exactly(`@${mention.username}`)
                        .notBefore(anyOf(letter, digit, charIn("@")))
                        .notAfter(anyOf(letter, digit, charIn("@"))),
                    [global],
                ),
                `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${getUserUri(
                    mention,
                )}">@${mention.username}</a>`,
            );

            finalText = finalText.replace(
                createRegExp(
                    exactly(
                        `@${mention.username}@${
                            new URL(config.http.base_url).host
                        }`,
                    ),
                    [global],
                ),
                `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${getUserUri(
                    mention,
                )}">@${mention.username}</a>`,
            );
        }
    }

    return finalText;
};

export const contentToHtml = async (
    content: Lysand.ContentFormat,
    mentions: UserWithRelations[] = [],
): Promise<string> => {
    let htmlContent: string;

    if (content["text/html"]) {
        htmlContent = content["text/html"].content;
    } else if (content["text/markdown"]) {
        htmlContent = await sanitizeHtml(
            await parse(content["text/markdown"].content),
        );
    } else if (content["text/plain"]) {
        // Split by newline and add <p> tags
        htmlContent = content["text/plain"].content
            .split("\n")
            .map((line) => `<p>${line}</p>`)
            .join("\n");
    } else {
        htmlContent = "";
    }

    // Replace mentions text
    htmlContent = await replaceTextMentions(htmlContent, mentions ?? []);

    // Linkify
    htmlContent = linkifyHtml(htmlContent, {
        defaultProtocol: "https",
        validate: {
            email: () => false,
        },
        target: "_blank",
        rel: "nofollow noopener noreferrer",
    });

    return htmlContent;
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
    emojis: EmojiWithInstance[],
    uri?: string,
    mentions?: UserWithRelations[],
    /** List of IDs of database Attachment objects */
    media_attachments?: string[],
    inReplyTo?: StatusWithRelations,
    quoting?: StatusWithRelations,
    application?: Application,
): Promise<StatusWithRelations | null> => {
    const htmlContent = await contentToHtml(content, mentions);

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

    const newStatus = (
        await db
            .insert(status)
            .values({
                authorId: author.id,
                content: htmlContent,
                contentSource:
                    content["text/plain"]?.content ||
                    content["text/markdown"]?.content ||
                    Object.entries(content)[0][1].content ||
                    "",
                contentType: "text/html",
                visibility,
                sensitive: is_sensitive,
                spoilerText: spoiler_text,
                uri: uri || null,
                inReplyToPostId: inReplyTo?.id,
                quotingPostId: quoting?.id,
                applicationId: application?.id ?? null,
                updatedAt: new Date().toISOString(),
            })
            .returning()
    )[0];

    // Connect emojis
    for (const emoji of foundEmojis) {
        await db
            .insert(emojiToStatus)
            .values({
                emojiId: emoji.id,
                statusId: newStatus.id,
            })
            .execute();
    }

    // Connect mentions
    for (const mention of mentions ?? []) {
        await db
            .insert(statusToMentions)
            .values({
                statusId: newStatus.id,
                userId: mention.id,
            })
            .execute();
    }

    // Set attachment parents
    if (media_attachments && media_attachments.length > 0) {
        await db
            .update(attachment)
            .set({
                statusId: newStatus.id,
            })
            .where(inArray(attachment.id, media_attachments));
    }

    return (
        (await findFirstStatuses({
            where: (status, { eq }) => eq(status.id, newStatus.id),
        })) || null
    );
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
            dualLogger.log(
                LogLevel.DEBUG,
                "Federation.Status",
                await response.text(),
            );
            dualLogger.log(
                LogLevel.ERROR,
                "Federation.Status",
                `Failed to federate status ${status.id} to ${user.uri}`,
            );
        }
    }
};

export const getUsersToFederateTo = async (
    status: StatusWithRelations,
): Promise<UserWithRelations[]> => {
    // Mentioned users
    const mentionedUsers =
        status.mentions.length > 0
            ? await findManyUsers({
                  where: (user, { or, and, isNotNull, eq, inArray }) =>
                      and(
                          isNotNull(user.instanceId),
                          inArray(
                              user.id,
                              status.mentions.map((mention) => mention.id),
                          ),
                      ),
                  with: {
                      ...userRelations,
                  },
              })
            : [];

    const usersThatCanSeePost = await findManyUsers({
        where: (user, { isNotNull }) => isNotNull(user.instanceId),
        with: {
            ...userRelations,
            relationships: {
                where: (relationship, { eq, and }) =>
                    and(
                        eq(relationship.subjectId, user.id),
                        eq(relationship.following, true),
                    ),
            },
        },
    });

    const fusedUsers = [...mentionedUsers, ...usersThatCanSeePost];

    const deduplicatedUsersById = fusedUsers.filter(
        (user, index, self) =>
            index === self.findIndex((t) => t.id === user.id),
    );

    return deduplicatedUsersById;
};

export const editStatus = async (
    statusToEdit: StatusWithRelations,
    data: {
        content: string;
        visibility?: APIStatus["visibility"];
        sensitive: boolean;
        spoiler_text: string;
        emojis?: EmojiWithInstance[];
        content_type?: string;
        uri?: string;
        mentions?: User[];
        media_attachments?: string[];
    },
): Promise<StatusWithRelations | null> => {
    const mentions = await parseTextMentions(data.content);

    // Parse emojis
    const emojis = await parseEmojis(data.content);

    // Fuse and deduplicate emojis
    data.emojis = data.emojis
        ? [...data.emojis, ...emojis].filter(
              (emoji, index, self) =>
                  index === self.findIndex((t) => t.id === emoji.id),
          )
        : emojis;

    const htmlContent = await contentToHtml({
        [data.content_type ?? "text/plain"]: {
            content: data.content,
        },
    });

    const updated = (
        await db
            .update(status)
            .set({
                content: htmlContent,
                contentSource: data.content,
                contentType: data.content_type,
                visibility: data.visibility,
                sensitive: data.sensitive,
                spoilerText: data.spoiler_text,
            })
            .where(eq(status.id, statusToEdit.id))
            .returning()
    )[0];

    // Connect emojis
    for (const emoji of data.emojis) {
        await db
            .insert(emojiToStatus)
            .values({
                emojiId: emoji.id,
                statusId: updated.id,
            })
            .execute();
    }

    // Connect mentions
    for (const mention of mentions) {
        await db
            .insert(statusToMentions)
            .values({
                statusId: updated.id,
                userId: mention.id,
            })
            .execute();
    }

    // Set attachment parents
    await db
        .update(attachment)
        .set({
            statusId: updated.id,
        })
        .where(inArray(attachment.id, data.media_attachments ?? []));

    return (
        (await findFirstStatuses({
            where: (status, { eq }) => eq(status.id, updated.id),
        })) || null
    );
};

export const isFavouritedBy = async (status: Status, user: User) => {
    return !!(await db.query.like.findFirst({
        where: (like, { and, eq }) =>
            and(eq(like.likerId, user.id), eq(like.likedId, status.id)),
    }));
};

/**
 * Converts this status to an API status.
 * @returns A promise that resolves with the API status.
 */
export const statusToAPI = async (
    statusToConvert: StatusWithRelations,
    userFetching?: UserWithRelations,
): Promise<APIStatus> => {
    const wasPinnedByUser = userFetching
        ? !!(await db.query.userPinnedNotes.findFirst({
              where: (relation, { and, eq }) =>
                  and(
                      eq(relation.statusId, statusToConvert.id),
                      eq(relation.userId, userFetching?.id),
                  ),
          }))
        : false;

    const wasRebloggedByUser = userFetching
        ? !!(await db.query.status.findFirst({
              where: (status, { eq, and }) =>
                  and(
                      eq(status.authorId, userFetching?.id),
                      eq(status.reblogId, statusToConvert.id),
                  ),
          }))
        : false;

    const wasMutedByUser = userFetching
        ? !!(await db.query.relationship.findFirst({
              where: (relationship, { and, eq }) =>
                  and(
                      eq(relationship.ownerId, userFetching.id),
                      eq(relationship.subjectId, statusToConvert.authorId),
                      eq(relationship.muting, true),
                  ),
          }))
        : false;

    // Convert mentions of local users from @username@host to @username
    const mentionedLocalUsers = statusToConvert.mentions.filter(
        (mention) => mention.instanceId === null,
    );

    let replacedContent = statusToConvert.content;

    for (const mention of mentionedLocalUsers) {
        replacedContent = replacedContent.replace(
            createRegExp(
                exactly(
                    `@${mention.username}@${
                        new URL(config.http.base_url).host
                    }`,
                ),
                [global],
            ),
            `@${mention.username}`,
        );
    }

    return {
        id: statusToConvert.id,
        in_reply_to_id: statusToConvert.inReplyToPostId || null,
        in_reply_to_account_id: statusToConvert.inReplyTo?.authorId || null,
        account: userToAPI(statusToConvert.author),
        created_at: new Date(statusToConvert.createdAt).toISOString(),
        application: statusToConvert.application
            ? applicationToAPI(statusToConvert.application)
            : null,
        card: null,
        content: replacedContent,
        emojis: statusToConvert.emojis.map((emoji) => emojiToAPI(emoji)),
        favourited: !!(statusToConvert.likes ?? []).find(
            (like) => like.likerId === userFetching?.id,
        ),
        favourites_count: (statusToConvert.likes ?? []).length,
        media_attachments: (statusToConvert.attachments ?? []).map(
            (a) => attachmentToAPI(a) as APIAttachment,
        ),
        mentions: statusToConvert.mentions.map((mention) => userToAPI(mention)),
        language: null,
        muted: wasMutedByUser,
        pinned: wasPinnedByUser,
        // TODO: Add polls
        poll: null,
        reblog: statusToConvert.reblog
            ? await statusToAPI(
                  statusToConvert.reblog as unknown as StatusWithRelations,
                  userFetching,
              )
            : null,
        reblogged: wasRebloggedByUser,
        reblogs_count: statusToConvert.reblogCount,
        replies_count: statusToConvert.replyCount,
        sensitive: statusToConvert.sensitive,
        spoiler_text: statusToConvert.spoilerText,
        tags: [],
        uri:
            statusToConvert.uri ||
            new URL(
                `/@${statusToConvert.author.username}/${statusToConvert.id}`,
                config.http.base_url,
            ).toString(),
        visibility: statusToConvert.visibility as APIStatus["visibility"],
        url:
            statusToConvert.uri ||
            new URL(
                `/@${statusToConvert.author.username}/${statusToConvert.id}`,
                config.http.base_url,
            ).toString(),
        bookmarked: false,
        quote: !!statusToConvert.quotingPostId /* statusToConvert.quoting
            ? await statusToAPI(
                  statusToConvert.quoting as unknown as StatusWithRelations,
                  userFetching,
              )
            : null, */,
        // @ts-expect-error Pleroma extension
        quote_id: statusToConvert.quotingPostId || undefined,
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
        attachments: (status.attachments ?? []).map((attachment) =>
            attachmentToLysand(attachment),
        ),
        is_sensitive: status.sensitive,
        mentions: status.mentions.map((mention) => mention.uri || ""),
        quotes: getStatusUri(status.quoting) ?? undefined,
        replies_to: getStatusUri(status.inReplyTo) ?? undefined,
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
