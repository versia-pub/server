import { mentionValidator } from "@/api";
import { sanitizeHtml, sanitizeHtmlInline } from "@/sanitization";
import markdownItTaskLists from "@hackmd/markdown-it-task-lists";
import type { ContentFormat } from "@versia/federation/types";
import { type Note, User, db } from "@versia/kit/db";
import { Instances, Users } from "@versia/kit/tables";
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
import { config } from "~/config.ts";
import {
    transformOutputToUserWithRelations,
    userExtrasTemplate,
    userRelations,
} from "./user.ts";

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
                    attachments: {
                        with: {
                            media: true,
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
                    reblogCount:
                        sql`(SELECT COUNT(*) FROM "Notes" WHERE "Notes"."reblogId" = "Notes_reblog".id)`.as(
                            "reblog_count",
                        ),
                    likeCount:
                        sql`(SELECT COUNT(*) FROM "Likes" WHERE "Likes"."likedId" = "Notes_reblog".id)`.as(
                            "like_count",
                        ),
                    replyCount:
                        sql`(SELECT COUNT(*) FROM "Notes" WHERE "Notes"."replyId" = "Notes_reblog".id)`.as(
                            "reply_count",
                        ),
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
        },
        extras: {
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
            reblogCount: Number(post.reblog.reblogCount),
            likeCount: Number(post.reblog.likeCount),
            replyCount: Number(post.reblog.replyCount),
            pinned: Boolean(post.reblog.pinned),
            reblogged: Boolean(post.reblog.reblogged),
            muted: Boolean(post.reblog.muted),
            liked: Boolean(post.reblog.liked),
        },
        reblogCount: Number(post.reblogCount),
        likeCount: Number(post.likeCount),
        replyCount: Number(post.replyCount),
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
export const parseTextMentions = async (
    text: string,
    author: User,
): Promise<User[]> => {
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
        const manager = await author.getFederationRequester();
        const uri = await User.webFinger(
            manager,
            person[1] ?? "",
            person[2] ?? "",
        );

        if (!uri) {
            continue;
        }

        const user = await User.resolve(uri);

        if (user) {
            finalList.push(user);
        }
    }

    return finalList;
};

export const replaceTextMentions = (text: string, mentions: User[]): string => {
    return mentions.reduce((finalText, mention) => {
        const { username, instance } = mention.data;
        const uri = mention.getUri();
        const baseHost = config.http.base_url.host;
        const linkTemplate = (displayText: string): string =>
            `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${uri}">${displayText}</a>`;

        if (mention.isRemote()) {
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
    content: ContentFormat,
    mentions: User[] = [],
    inline = false,
): Promise<string> => {
    const sanitizer = inline ? sanitizeHtmlInline : sanitizeHtml;
    let htmlContent = "";

    if (content["text/html"]) {
        htmlContent = await sanitizer(content["text/html"].content);
    } else if (content["text/markdown"]) {
        htmlContent = await sanitizer(
            await markdownParse(content["text/markdown"].content),
        );
    } else if (content["text/plain"]?.content) {
        htmlContent = (await sanitizer(content["text/plain"].content))
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
