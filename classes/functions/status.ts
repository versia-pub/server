import markdownItTaskLists from "@hackmd/markdown-it-task-lists";
import { db, type Note, User } from "@versia/kit/db";
import { Instances, Users } from "@versia/kit/tables";
import { FederationRequester } from "@versia/sdk/http";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import linkifyHtml from "linkify-html";
import {
    anyOf,
    charIn,
    createRegExp,
    digit,
    exactly,
    global,
    letter,
} from "magic-regexp";
import MarkdownIt from "markdown-it";
import markdownItContainer from "markdown-it-container";
import markdownItTocDoneRight from "markdown-it-toc-done-right";
import { mentionValidator } from "@/api";
import { sanitizeHtml, sanitizeHtmlInline } from "@/sanitization";
import { config } from "~/config.ts";
import type * as VersiaEntities from "~/packages/sdk/entities/index.ts";
import { transformOutputToUserWithRelations, userRelations } from "./user.ts";

/**
 * Wrapper against the Status object to make it easier to work with
 * @param query
 * @returns
 */
export const findManyNotes = async (
    query: Parameters<typeof db.query.Notes.findMany>[0],
    userId?: string,
): Promise<(typeof Note.$type)[]> => {
    const output = await db.query.Notes.findMany({
        ...query,
        with: {
            ...query?.with,
            attachments: {
                with: {
                    media: true,
                },
            },
            reactions: {
                with: {
                    emoji: {
                        with: {
                            instance: true,
                            media: true,
                        },
                    },
                },
            },
            emojis: {
                with: {
                    emoji: {
                        with: {
                            instance: true,
                            media: true,
                        },
                    },
                },
            },
            author: {
                with: {
                    ...userRelations,
                },
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
                    attachments: {
                        with: {
                            media: true,
                        },
                    },
                    reactions: {
                        with: {
                            emoji: {
                                with: {
                                    instance: true,
                                    media: true,
                                },
                            },
                        },
                    },
                    emojis: {
                        with: {
                            emoji: {
                                with: {
                                    instance: true,
                                    media: true,
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
                            },
                        },
                    },
                    author: {
                        with: {
                            ...userRelations,
                        },
                    },
                    poll: {
                        with: {
                            options: {
                                with: {
                                    votes: true,
                                },
                            },
                            votes: true,
                        },
                    },
                },
                extras: {
                    pinned: userId
                        ? sql`EXISTS (SELECT 1 FROM "UserToPinnedNotes" WHERE "UserToPinnedNotes"."noteId" = "Notes_reblog".id AND "UserToPinnedNotes"."userId" = ${userId})`.as(
                              "pinned",
                          )
                        : sql`false`.as("pinned"),
                    reblogged: userId
                        ? sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."authorId" = ${userId} AND "Notes"."reblogId" = "Notes_reblog".id)`.as(
                              "reblogged",
                          )
                        : sql`false`.as("reblogged"),
                    muted: userId
                        ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."ownerId" = ${userId} AND "Relationships"."subjectId" = "Notes_reblog"."authorId" AND "Relationships"."muting" = true)`.as(
                              "muted",
                          )
                        : sql`false`.as("muted"),
                    liked: userId
                        ? sql`EXISTS (SELECT 1 FROM "Likes" WHERE "Likes"."likedId" = "Notes_reblog".id AND "Likes"."likerId" = ${userId})`.as(
                              "liked",
                          )
                        : sql`false`.as("liked"),
                },
            },
            reply: true,
            quote: true,
            poll: {
                with: {
                    options: {
                        with: {
                            votes: true,
                        },
                    },
                    votes: true,
                },
            },
        },
        extras: {
            pinned: userId
                ? sql`EXISTS (SELECT 1 FROM "UserToPinnedNotes" WHERE "UserToPinnedNotes"."noteId" = "Notes".id AND "UserToPinnedNotes"."userId" = ${userId})`.as(
                      "pinned",
                  )
                : sql`false`.as("pinned"),
            reblogged: userId
                ? sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."authorId" = ${userId} AND "Notes"."reblogId" = "Notes".id)`.as(
                      "reblogged",
                  )
                : sql`false`.as("reblogged"),
            muted: userId
                ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."ownerId" = ${userId} AND "Relationships"."subjectId" = "Notes"."authorId" AND "Relationships"."muting" = true)`.as(
                      "muted",
                  )
                : sql`false`.as("muted"),
            liked: userId
                ? sql`EXISTS (SELECT 1 FROM "Likes" WHERE "Likes"."likedId" = "Notes".id AND "Likes"."likerId" = ${userId})`.as(
                      "liked",
                  )
                : sql`false`.as("liked"),
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
        attachments: post.attachments.map((attachment) => attachment.media),
        emojis: (post.emojis ?? []).map((emoji) => emoji.emoji),
        poll: post.poll ? {
            ...post.poll,
            options: post.poll.options.sort((a, b) => a.index - b.index),
        } : null,
        reblog: post.reblog && {
            ...post.reblog,
            author: transformOutputToUserWithRelations(post.reblog.author),
            mentions: post.reblog.mentions.map((mention) => ({
                ...mention.user,
                endpoints: mention.user.endpoints,
            })),
            attachments: post.reblog.attachments.map(
                (attachment) => attachment.media,
            ),
            emojis: (post.reblog.emojis ?? []).map((emoji) => emoji.emoji),
            poll: post.reblog.poll ? {
                ...post.reblog.poll,
                options: post.reblog.poll.options.sort((a, b) => a.index - b.index),
            } : null,
            pinned: Boolean(post.reblog.pinned),
            reblogged: Boolean(post.reblog.reblogged),
            muted: Boolean(post.reblog.muted),
            liked: Boolean(post.reblog.liked),
        },
        pinned: Boolean(post.pinned),
        reblogged: Boolean(post.reblogged),
        muted: Boolean(post.muted),
        liked: Boolean(post.liked),
    }));
};

/**
 * Get people mentioned in the content (match @username or @username@domain.com mentions)
 * @param text The text to parse mentions from.
 * @returns An array of users mentioned in the text.
 */
export const parseTextMentions = async (text: string): Promise<User[]> => {
    const mentionedPeople = [...text.matchAll(mentionValidator)];
    if (mentionedPeople.length === 0) {
        return [];
    }

    const baseUrlHost = config.http.base_url.host;
    const isLocal = (host?: string): boolean => host === baseUrlHost || !host;

    // Find local and matching users
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
                        eq(Users.username, person[1] ?? ""),
                        isLocal(person[2])
                            ? isNull(Users.instanceId)
                            : eq(Instances.baseUrl, person[2] ?? ""),
                    ),
                ),
            ),
        );

    // Separate found and unresolved users
    const finalList = await User.manyFromSql(
        inArray(
            Users.id,
            foundUsers.map((u) => u.id),
        ),
    );

    // Every remote user that isn't in database
    const notFoundRemoteUsers = mentionedPeople.filter(
        (p) =>
            !(
                foundUsers.some(
                    (user) => user.username === p[1] && user.baseUrl === p[2],
                ) || isLocal(p[2])
            ),
    );

    // Resolve remote mentions not in database
    for (const person of notFoundRemoteUsers) {
        const url = await FederationRequester.resolveWebFinger(
            person[1] ?? "",
            person[2] ?? "",
        );

        if (url) {
            const user = await User.resolve(url);

            if (user) {
                finalList.push(user);
            }
        }
    }

    return finalList;
};

export const replaceTextMentions = (text: string, mentions: User[]): string => {
    return mentions.reduce((finalText, mention) => {
        const { username, instance } = mention.data;
        const { uri } = mention;
        const baseHost = config.http.base_url.host;
        const linkTemplate = (displayText: string): string =>
            `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${uri}">${displayText}</a>`;

        if (mention.remote) {
            return finalText.replaceAll(
                `@${username}@${instance?.baseUrl}`,
                linkTemplate(`@${username}@${instance?.baseUrl}`),
            );
        }

        return finalText.replace(
            createRegExp(
                exactly(
                    exactly(`@${username}`)
                        .notBefore(anyOf(letter, digit, charIn("@")))
                        .notAfter(anyOf(letter, digit, charIn("@"))),
                ).or(exactly(`@${username}@${baseHost}`)),
                [global],
            ),
            linkTemplate(`@${username}@${baseHost}`),
        );
    }, text);
};

export const contentToHtml = async (
    content: VersiaEntities.TextContentFormat,
    mentions: User[] = [],
    inline = false,
): Promise<string> => {
    const sanitizer = inline ? sanitizeHtmlInline : sanitizeHtml;
    let htmlContent = "";

    if (content.data["text/html"]) {
        htmlContent = await sanitizer(content.data["text/html"].content);
    } else if (content.data["text/markdown"]) {
        htmlContent = await sanitizer(
            await markdownParse(content.data["text/markdown"].content),
        );
    } else if (content.data["text/plain"]?.content) {
        htmlContent = (await sanitizer(content.data["text/plain"].content))
            .split("\n")
            .map((line) => `<p>${line}</p>`)
            .join("\n");
    }

    htmlContent = replaceTextMentions(htmlContent, mentions);

    return linkifyHtml(htmlContent, {
        defaultProtocol: "https",
        validate: { email: (): false => false },
        target: "_blank",
        rel: "nofollow noopener noreferrer",
    });
};

export const markdownParse = async (content: string): Promise<string> => {
    return (await getMarkdownRenderer()).render(content);
};

export const getMarkdownRenderer = (): MarkdownIt => {
    const renderer = MarkdownIt({
        html: true,
        linkify: true,
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
