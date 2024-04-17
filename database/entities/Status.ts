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
    attachment,
    emojiToStatus,
    instance,
    notification,
    status,
    statusToMentions,
    user,
} from "~drizzle/schema";
import { Note } from "~packages/database-interface/note";
import { LogLevel } from "~packages/log-manager";
import type { Status as APIStatus } from "~types/mastodon/status";
import type { Application } from "./Application";
import { attachmentFromLysand, attachmentToLysand } from "./Attachment";
import {
    type EmojiWithInstance,
    emojiToLysand,
    fetchEmoji,
    parseEmojis,
} from "./Emoji";
import { objectToInboxRequest } from "./Federation";
import type { Like } from "./Like";
import {
    type User,
    type UserWithInstance,
    type UserWithRelations,
    findManyUsers,
    getUserUri,
    resolveUser,
    resolveWebFinger,
    transformOutputToUserWithRelations,
    userExtrasTemplate,
    userRelations,
} from "./User";

export type Status = InferSelectModel<typeof status>;

export type StatusWithRelations = Status & {
    author: UserWithRelations;
    mentions: UserWithInstance[];
    attachments: InferSelectModel<typeof attachment>[];
    reblog: StatusWithoutRecursiveRelations | null;
    emojis: EmojiWithInstance[];
    likes: Like[];
    inReplyTo: Status | null;
    quoting: Status | null;
    application: Application | null;
    reblogCount: number;
    likeCount: number;
    replyCount: number;
};

export type StatusWithoutRecursiveRelations = Omit<
    StatusWithRelations,
    "inReplyTo" | "quoting" | "reblog"
>;

export const noteExtras = {
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

/**
 * Wrapper against the Status object to make it easier to work with
 * @param query
 * @returns
 */
export const findManyNotes = async (
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
                        with: {
                            instance: true,
                        },
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
                extras: {
                    ...noteExtras,
                },
            },
            inReplyTo: true,
            quoting: true,
        },
        extras: {
            ...noteExtras,
            ...query?.extras,
        },
    });

    return output.map((post) => ({
        ...post,
        author: transformOutputToUserWithRelations(post.author),
        mentions: post.mentions.map((mention) => ({
            ...mention.user,
            endpoints: mention.user.endpoints as User["endpoints"],
        })),
        emojis: (post.emojis ?? []).map(
            (emoji) =>
                (emoji as unknown as Record<string, object>)
                    .emoji as EmojiWithInstance,
        ),
        reblog: post.reblog && {
            ...post.reblog,
            author: transformOutputToUserWithRelations(post.reblog.author),
            mentions: post.reblog.mentions.map((mention) => ({
                ...mention.user,
                endpoints: mention.user.endpoints as User["endpoints"],
            })),
            emojis: (post.reblog.emojis ?? []).map(
                (emoji) =>
                    (emoji as unknown as Record<string, object>)
                        .emoji as EmojiWithInstance,
            ),
            reblogCount: Number(post.reblog.reblogCount),
            likeCount: Number(post.reblog.likeCount),
            replyCount: Number(post.reblog.replyCount),
        },
        reblogCount: Number(post.reblogCount),
        likeCount: Number(post.likeCount),
        replyCount: Number(post.replyCount),
    }));
};

export const findFirstNote = async (
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
                        with: {
                            instance: true,
                        },
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
                extras: {
                    ...noteExtras,
                },
            },
            inReplyTo: true,
            quoting: true,
        },
        extras: {
            ...noteExtras,
            ...query?.extras,
        },
    });

    if (!output) return null;

    return {
        ...output,
        author: transformOutputToUserWithRelations(output.author),
        mentions: output.mentions.map((mention) => ({
            ...mention.user,
            endpoints: mention.user.endpoints as User["endpoints"],
        })),
        emojis: (output.emojis ?? []).map(
            (emoji) =>
                (emoji as unknown as Record<string, object>)
                    .emoji as EmojiWithInstance,
        ),
        reblog: output.reblog && {
            ...output.reblog,
            author: transformOutputToUserWithRelations(output.reblog.author),
            mentions: output.reblog.mentions.map((mention) => ({
                ...mention.user,
                endpoints: mention.user.endpoints as User["endpoints"],
            })),
            emojis: (output.reblog.emojis ?? []).map(
                (emoji) =>
                    (emoji as unknown as Record<string, object>)
                        .emoji as EmojiWithInstance,
            ),
            reblogCount: Number(output.reblog.reblogCount),
            likeCount: Number(output.reblog.likeCount),
            replyCount: Number(output.reblog.replyCount),
        },
        reblogCount: Number(output.reblogCount),
        likeCount: Number(output.likeCount),
        replyCount: Number(output.replyCount),
    };
};

export const resolveNote = async (
    uri?: string,
    providedNote?: Lysand.Note,
): Promise<Note> => {
    if (!uri && !providedNote) {
        throw new Error("No URI or note provided");
    }

    const foundStatus = await Note.fromSql(
        eq(status.uri, uri ?? providedNote?.uri ?? ""),
    );

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

    const createdNote = await Note.fromData(
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
        note.replies_to
            ? (await resolveNote(note.replies_to)).getStatus().id
            : undefined,
        note.quotes
            ? (await resolveNote(note.quotes)).getStatus().id
            : undefined,
    );

    if (!createdNote) {
        throw new Error("Failed to create status");
    }

    return createdNote;
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

export const federateNote = async (note: Note) => {
    for (const user of await note.getUsersToFederateTo()) {
        // TODO: Add queue system
        const request = await objectToInboxRequest(
            note.toLysand(),
            note.getAuthor(),
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
                `Failed to federate status ${note.getStatus().id} to ${
                    user.uri
                }`,
            );
        }
    }
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
): Promise<Note | null> => {
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

    const note = await Note.fromId(statusToEdit.id);

    if (!note) {
        return null;
    }

    const updated = await note.update({
        content: htmlContent,
        contentSource: data.content,
        contentType: data.content_type,
        visibility: data.visibility,
        sensitive: data.sensitive,
        spoilerText: data.spoiler_text,
    });

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

    // Send notifications for mentioned local users
    for (const mention of mentions ?? []) {
        if (mention.instanceId === null) {
            await db.insert(notification).values({
                accountId: statusToEdit.authorId,
                notifiedId: mention.id,
                type: "mention",
                statusId: updated.id,
            });
        }
    }

    // Set attachment parents
    await db
        .update(attachment)
        .set({
            statusId: updated.id,
        })
        .where(inArray(attachment.id, data.media_attachments ?? []));

    return await Note.fromId(updated.id);
};

export const isFavouritedBy = async (status: Status, user: User) => {
    return !!(await db.query.like.findFirst({
        where: (like, { and, eq }) =>
            and(eq(like.likerId, user.id), eq(like.likedId, status.id)),
    }));
};

export const getStatusUri = (status?: Status | null) => {
    if (!status) return undefined;

    return (
        status.uri ||
        new URL(`/objects/${status.id}`, config.http.base_url).toString()
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
