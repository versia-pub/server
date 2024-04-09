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
import { applicationToAPI } from "./Application";
import { attachmentToAPI } from "./Attachment";
import { emojiToAPI, emojiToLysand, parseEmojis } from "./Emoji";
import type { UserWithRelations } from "./User";
import { fetchRemoteUser, parseMentionsUris, userToAPI } from "./User";
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

export const fetchFromRemote = async (uri: string): Promise<Status | null> => {
    // Check if already in database

    const existingStatus: StatusWithRelations | null =
        await client.status.findFirst({
            where: {
                uri: uri,
            },
            include: statusAndUserRelations,
        });

    if (existingStatus) return existingStatus;

    const status = await fetch(uri);

    if (status.status === 404) return null;

    const body = (await status.json()) as LysandPublication;

    const content = getBestContentType(body.contents);

    const emojis = await parseEmojis(content?.content || "");

    const author = await fetchRemoteUser(body.author);

    let replyStatus: Status | null = null;
    let quotingStatus: Status | null = null;

    if (body.replies_to.length > 0) {
        replyStatus = await fetchFromRemote(body.replies_to[0]);
    }

    if (body.quotes.length > 0) {
        quotingStatus = await fetchFromRemote(body.quotes[0]);
    }

    return await createNewStatus({
        account: author,
        content: content?.content || "",
        content_type: content?.content_type,
        application: null,
        // TODO: Add visibility
        visibility: "public",
        spoiler_text: body.subject || "",
        uri: body.uri,
        sensitive: body.is_sensitive,
        emojis: emojis,
        mentions: await parseMentionsUris(body.mentions),
        reply: replyStatus
            ? {
                  status: replyStatus,
                  user: (replyStatus as StatusWithRelations).author,
              }
            : undefined,
        quote: quotingStatus || undefined,
    });
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
 * Creates a new status and saves it to the database.
 * @param data The data for the new status.
 * @returns A promise that resolves with the new status.
 */
export const createNewStatus = async (data: {
    account: User;
    application: Application | null;
    content: string;
    visibility: APIStatus["visibility"];
    sensitive: boolean;
    spoiler_text: string;
    emojis?: Emoji[];
    content_type?: string;
    uri?: string;
    mentions?: UserWithRelations[];
    media_attachments?: string[];
    reply?: {
        status: Status;
        user: User;
    };
    quote?: Status;
}) => {
    // Get people mentioned in the content (match @username or @username@domain.com mentions)
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

    // Turn each @username or @username@instance mention into an anchor link
    for (const mention of mentions) {
        const matches = data.content.match(
            new RegExp(
                `@${mention.username}(@${mention.instance?.base_url})?`,
                "g",
            ),
        );

        if (!matches) continue;

        for (const match of matches) {
            formattedContent = formattedContent.replace(
                new RegExp(
                    `@${mention.username}(@${mention.instance?.base_url})?`,
                    "g",
                ),
                `<a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${
                    mention.uri ||
                    new URL(
                        `/@${mention.username}`,
                        config.http.base_url,
                    ).toString()
                }">${match}</a>`,
            );
        }
    }

    const status = await client.status.create({
        data: {
            authorId: data.account.id,
            applicationId: data.application?.id,
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
            inReplyToPostId: data.reply?.status.id,
            quotingPostId: data.quote?.id,
            instanceId: data.account.instanceId || undefined,
            isReblog: false,
            uri: data.uri || null,
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

    // Create notification
    if (status.inReplyToPost) {
        await client.notification.create({
            data: {
                notifiedId: status.inReplyToPost.authorId,
                accountId: status.authorId,
                type: "mention",
                statusId: status.id,
            },
        });
    }

    // Add to search index
    await addStausToMeilisearch(status);

    return status;
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

/* export const statusToActivityPub = async (
	status: StatusWithRelations
	// user?: UserWithRelations
): Promise<any> => {
	// replace any with your ActivityPub type
	return {
		"@context": [
			"https://www.w3.org/ns/activitystreams",
			"https://mastodon.social/schemas/litepub-0.1.jsonld",
		],
		id: `${config.http.base_url}/users/${status.authorId}/statuses/${status.id}`,
		type: "Note",
		summary: status.spoilerText,
		content: status.content,
		published: new Date(status.createdAt).toISOString(),
		url: `${config.http.base_url}/users/${status.authorId}/statuses/${status.id}`,
		attributedTo: `${config.http.base_url}/users/${status.authorId}`,
		to: ["https://www.w3.org/ns/activitystreams#Public"],
		cc: [], // add recipients here
		sensitive: status.sensitive,
		attachment: (status.attachments ?? []).map(
			a => attachmentToActivityPub(a) as ActivityPubAttachment // replace with your function
		),
		tag: [], // add tags here
		replies: {
			id: `${config.http.base_url}/users/${status.authorId}/statuses/${status.id}/replies`,
			type: "Collection",
			totalItems: status._count.replies,
		},
		likes: {
			id: `${config.http.base_url}/users/${status.authorId}/statuses/${status.id}/likes`,
			type: "Collection",
			totalItems: status._count.likes,
		},
		shares: {
			id: `${config.http.base_url}/users/${status.authorId}/statuses/${status.id}/shares`,
			type: "Collection",
			totalItems: status._count.reblogs,
		},
		inReplyTo: status.inReplyToPostId
			? `${config.http.base_url}/users/${status.inReplyToPost?.authorId}/statuses/${status.inReplyToPostId}`
			: null,
		visibility: "public", // adjust as needed
		// add more fields as needed
	};
}; */

export const statusToLysand = (status: StatusWithRelations): Note => {
    return {
        type: "Note",
        created_at: new Date(status.createdAt).toISOString(),
        id: status.id,
        author: status.authorId,
        uri: new URL(`/statuses/${status.id}`, config.http.base_url).toString(),
        contents: [
            {
                content: status.content,
                content_type: "text/html",
            },
            {
                // Content converted to plaintext
                content: htmlToText(status.content),
                content_type: "text/plain",
            },
        ],
        // TODO: Add attachments
        attachments: [],
        is_sensitive: status.sensitive,
        mentions: status.mentions.map((mention) => mention.uri || ""),
        quotes: status.quotingPost ? [status.quotingPost.uri || ""] : [],
        replies_to: status.inReplyToPostId ? [status.inReplyToPostId] : [],
        subject: status.spoilerText,
        extensions: {
            "org.lysand:custom_emojis": {
                emojis: status.emojis.map((emoji) => emojiToLysand(emoji)),
            },
            // TODO: Add polls and reactions
        },
    };
};
