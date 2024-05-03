import markdownItTaskLists from "@hackmd/markdown-it-task-lists";
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
import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import markdownItContainer from "markdown-it-container";
import markdownItTocDoneRight from "markdown-it-toc-done-right";
import { db } from "~drizzle/db";
import { type Attachments, Instances, Notes, Users } from "~drizzle/schema";
import { Note } from "~packages/database-interface/note";
import { User } from "~packages/database-interface/user";
import { LogLevel } from "~packages/log-manager";
import type { Status as APIStatus } from "~types/mastodon/status";
import type { Application } from "./Application";
import { attachmentFromLysand } from "./Attachment";
import { type EmojiWithInstance, fetchEmoji } from "./Emoji";
import { objectToInboxRequest } from "./Federation";
import type { Like } from "./Like";
import {
    type UserType,
    type UserWithInstance,
    type UserWithRelations,
    resolveWebFinger,
    transformOutputToUserWithRelations,
    userExtrasTemplate,
    userRelations,
} from "./User";

export type Status = InferSelectModel<typeof Notes>;

export type StatusWithRelations = Status & {
    author: UserWithRelations;
    mentions: UserWithInstance[];
    attachments: InferSelectModel<typeof Attachments>[];
    reblog: StatusWithoutRecursiveRelations | null;
    emojis: EmojiWithInstance[];
    likes: Like[];
    reply: Status | null;
    quote: Status | null;
    application: Application | null;
    reblogCount: number;
    likeCount: number;
    replyCount: number;
};

export type StatusWithoutRecursiveRelations = Omit<
    StatusWithRelations,
    "reply" | "quote" | "reblog"
>;

export const noteExtras = {
    reblogCount:
        sql`(SELECT COUNT(*) FROM "Notes" WHERE "Notes"."reblogId" = "Notes".id)`.as(
            "reblog_count",
        ),
    likeCount:
        sql`(SELECT COUNT(*) FROM "Likes" WHERE "Likes"."likedId" = "Notes".id)`.as(
            "like_count",
        ),
    replyCount:
        sql`(SELECT COUNT(*) FROM "Notes" WHERE "Notes"."replyId" = "Notes".id)`.as(
            "reply_count",
        ),
};

/**
 * Wrapper against the Status object to make it easier to work with
 * @param query
 * @returns
 */
export const findManyNotes = async (
    query: Parameters<typeof db.query.Notes.findMany>[0],
): Promise<StatusWithRelations[]> => {
    const output = await db.query.Notes.findMany({
        ...query,
        with: {
            ...query?.with,
            attachments: {
                where: (attachment, { eq }) =>
                    eq(attachment.noteId, sql`"Notes"."id"`),
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
                extras: userExtrasTemplate("Notes_author"),
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
                                    "Notes_reblog_mentions_user",
                                ),
                            },
                        },
                    },
                    author: {
                        with: {
                            ...userRelations,
                        },
                        extras: userExtrasTemplate("Notes_reblog_author"),
                    },
                },
                extras: {
                    ...noteExtras,
                },
            },
            reply: true,
            quote: true,
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
            endpoints: mention.user.endpoints,
        })),
        emojis: (post.emojis ?? []).map((emoji) => emoji.emoji),
        reblog: post.reblog && {
            ...post.reblog,
            author: transformOutputToUserWithRelations(post.reblog.author),
            mentions: post.reblog.mentions.map((mention) => ({
                ...mention.user,
                endpoints: mention.user.endpoints,
            })),
            emojis: (post.reblog.emojis ?? []).map((emoji) => emoji.emoji),
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
    query: Parameters<typeof db.query.Notes.findFirst>[0],
): Promise<StatusWithRelations | null> => {
    const output = await db.query.Notes.findFirst({
        ...query,
        with: {
            ...query?.with,
            attachments: {
                where: (attachment, { eq }) =>
                    eq(attachment.noteId, sql`"Notes"."id"`),
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
                extras: userExtrasTemplate("Notes_author"),
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
                                    "Notes_reblog_mentions_user",
                                ),
                            },
                        },
                    },
                    author: {
                        with: {
                            ...userRelations,
                        },
                        extras: userExtrasTemplate("Notes_reblog_author"),
                    },
                },
                extras: {
                    ...noteExtras,
                },
            },
            reply: true,
            quote: true,
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
            endpoints: mention.user.endpoints,
        })),
        emojis: (output.emojis ?? []).map((emoji) => emoji.emoji),
        reblog: output.reblog && {
            ...output.reblog,
            author: transformOutputToUserWithRelations(output.reblog.author),
            mentions: output.reblog.mentions.map((mention) => ({
                ...mention.user,
                endpoints: mention.user.endpoints,
            })),
            emojis: (output.reblog.emojis ?? []).map((emoji) => emoji.emoji),
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
        eq(Notes.uri, uri ?? providedNote?.uri ?? ""),
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

    const author = await User.resolve(note.author);

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
                .map((mention) => User.resolve(mention))
                .filter((mention) => mention !== null) as Promise<User>[],
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
export const parseTextMentions = async (text: string): Promise<User[]> => {
    const mentionedPeople = [...text.matchAll(createMentionRegExp())] ?? [];
    if (mentionedPeople.length === 0) return [];

    const baseUrlHost = new URL(config.http.base_url).host;

    const isLocal = (host?: string) => host === baseUrlHost || !host;

    const foundUsers = await db
        .select({
            id: Users.id,
            username: Users.username,
            baseUrl: Instances.baseUrl,
        })
        .from(Users)
        .leftJoin(Instances, eq(Users.instanceId, Instances.id))
        .where(
            or(
                ...mentionedPeople.map((person) =>
                    and(
                        eq(Users.username, person?.[1] ?? ""),
                        isLocal(person?.[2])
                            ? isNull(Users.instanceId)
                            : eq(Instances.baseUrl, person?.[2] ?? ""),
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
            ? await User.manyFromSql(
                  inArray(
                      Users.id,
                      foundUsers.map((u) => u.id),
                  ),
              )
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

export const replaceTextMentions = async (text: string, mentions: User[]) => {
    let finalText = text;
    for (const mention of mentions) {
        const user = mention.getUser();
        // Replace @username and @username@domain
        if (user.instance) {
            finalText = finalText.replace(
                createRegExp(
                    exactly(`@${user.username}@${user.instance.baseUrl}`),
                    [global],
                ),
                `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${mention.getUri()}">@${
                    user.username
                }@${user.instance.baseUrl}</a>`,
            );
        } else {
            finalText = finalText.replace(
                // Only replace @username if it doesn't have another @ right after
                createRegExp(
                    exactly(`@${user.username}`)
                        .notBefore(anyOf(letter, digit, charIn("@")))
                        .notAfter(anyOf(letter, digit, charIn("@"))),
                    [global],
                ),
                `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${mention.getUri()}">@${
                    user.username
                }</a>`,
            );

            finalText = finalText.replace(
                createRegExp(
                    exactly(
                        `@${user.username}@${
                            new URL(config.http.base_url).host
                        }`,
                    ),
                    [global],
                ),
                `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${mention.getUri()}">@${
                    user.username
                }</a>`,
            );
        }
    }

    return finalText;
};

export const contentToHtml = async (
    content: Lysand.ContentFormat,
    mentions: User[] = [],
): Promise<string> => {
    let htmlContent: string;

    if (content["text/html"]) {
        htmlContent = await sanitizeHtml(content["text/html"].content);
    } else if (content["text/markdown"]) {
        htmlContent = await sanitizeHtml(
            await markdownParse(content["text/markdown"].content),
        );
    } else if (content["text/plain"]?.content) {
        // Split by newline and add <p> tags
        htmlContent = (await sanitizeHtml(content["text/plain"].content))
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

export const markdownParse = async (content: string) => {
    return (await getMarkdownRenderer()).render(content);
};

export const getMarkdownRenderer = async () => {
    const renderer = MarkdownIt({
        html: true,
        linkify: true,
    });

    renderer.use(markdownItAnchor, {
        permalink: markdownItAnchor.permalink.ariaHidden({
            symbol: "",
            placement: "before",
        }),
    });

    renderer.use(markdownItTocDoneRight, {
        containerClass: "toc",
        level: [1, 2, 3, 4],
        listType: "ul",
        listClass: "toc-list",
        itemClass: "toc-item",
        linkClass: "toc-link",
    });

    renderer.use(markdownItTaskLists);

    renderer.use(markdownItContainer);

    return renderer;
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
                `Failed to federate status ${
                    note.getStatus().id
                } to ${user.getUri()}`,
            );
        }
    }
};

export const isFavouritedBy = async (status: Status, user: UserType) => {
    return !!(await db.query.Likes.findFirst({
        where: (like, { and, eq }) =>
            and(eq(like.likerId, user.id), eq(like.likedId, status.id)),
    }));
};
