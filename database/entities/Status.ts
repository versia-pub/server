/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { getConfig } from "@config";
import {
	UserWithRelations,
	fetchRemoteUser,
	parseMentionsUris,
	userRelations,
	userToAPI,
} from "./User";
import { client } from "~database/datasource";
import { LysandPublication, Note } from "~types/lysand/Object";
import { htmlToText } from "html-to-text";
import { getBestContentType } from "@content_types";
import {
	Application,
	Emoji,
	Instance,
	Like,
	Relationship,
	Status,
	User,
} from "@prisma/client";
import { emojiToAPI, emojiToLysand, parseEmojis } from "./Emoji";
import { APIStatus } from "~types/entities/status";
import { applicationToAPI } from "./Application";

const config = getConfig();

export const statusAndUserRelations = {
	author: {
		include: userRelations,
	},
	application: true,
	emojis: true,
	inReplyToPost: {
		include: {
			author: {
				include: userRelations,
			},
			application: true,
			emojis: true,
			inReplyToPost: {
				include: {
					author: true,
				},
			},
			instance: true,
			mentions: true,
			pinnedBy: true,
			_count: {
				select: {
					replies: true,
				},
			},
		},
	},
	instance: true,
	mentions: true,
	pinnedBy: true,
	_count: {
		select: {
			replies: true,
			likes: true,
		},
	},
	reblog: {
		include: {
			author: {
				include: userRelations,
			},
			application: true,
			emojis: true,
			inReplyToPost: {
				include: {
					author: true,
				},
			},
			instance: true,
			mentions: true,
			pinnedBy: true,
			_count: {
				select: {
					replies: true,
				},
			},
		},
	},
	quotingPost: {
		include: {
			author: {
				include: userRelations,
			},
			application: true,
			emojis: true,
			inReplyToPost: {
				include: {
					author: true,
				},
			},
			instance: true,
			mentions: true,
			pinnedBy: true,
			_count: {
				select: {
					replies: true,
				},
			},
		},
	},
	likes: {
		include: {
			liker: true,
		},
	},
};

export type StatusWithRelations = Status & {
	author: UserWithRelations;
	application: Application | null;
	emojis: Emoji[];
	inReplyToPost:
		| (Status & {
				author: UserWithRelations;
				application: Application | null;
				emojis: Emoji[];
				inReplyToPost: Status | null;
				instance: Instance | null;
				mentions: User[];
				pinnedBy: User[];
				_count: {
					replies: number;
				};
		  })
		| null;
	instance: Instance | null;
	mentions: User[];
	pinnedBy: User[];
	_count: {
		replies: number;
		likes: number;
	};
	reblog:
		| (Status & {
				author: UserWithRelations;
				application: Application | null;
				emojis: Emoji[];
				inReplyToPost: Status | null;
				instance: Instance | null;
				mentions: User[];
				pinnedBy: User[];
				_count: {
					replies: number;
				};
		  })
		| null;
	quotingPost:
		| (Status & {
				author: UserWithRelations;
				application: Application | null;
				emojis: Emoji[];
				inReplyToPost: Status | null;
				instance: Instance | null;
				mentions: User[];
				pinnedBy: User[];
				_count: {
					replies: number;
				};
		  })
		| null;
	likes: (Like & {
		liker: User;
	})[];
};

/**
 * Represents a status (i.e. a post)
 */

/**
 * Returns whether this status is viewable by a user.
 * @param user The user to check.
 * @returns Whether this status is viewable by the user.
 */
export const isViewableByUser = (status: Status, user: User | null) => {
	if (status.visibility === "public") return true;
	else if (status.visibility === "unlisted") return true;
	else if (status.visibility === "private") {
		// @ts-expect-error Prisma TypeScript types dont include relations
		return !!(user?.relationships as Relationship[]).find(
			rel => rel.id === status.authorId
		);
	} else {
		// @ts-expect-error Prisma TypeScript types dont include relations
		return user && (status.mentions as User[]).includes(user);
	}
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
					user: (replyStatus as any).author,
			  }
			: undefined,
		quote: quotingStatus || undefined,
	});
};

/**
 * Return all the ancestors of this post,
 */
// eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
export const getAncestors = async (
	status: StatusWithRelations,
	fetcher: UserWithRelations | null
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

	const viewableAncestors = ancestors.filter(ancestor =>
		isViewableByUser(ancestor, fetcher)
	);
	return viewableAncestors;
};

/**
 * Return all the descendants of this post (recursive)
 * Temporary implementation, will be replaced with a recursive SQL query when Prisma adds support for it
 */
// eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
export const getDescendants = async (
	status: StatusWithRelations,
	fetcher: UserWithRelations | null,
	depth = 0
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
				depth + 1
			);
			descendants.push(...childDescendants);
		}
	}

	// Filter for posts that are viewable by the user

	const viewableDescendants = descendants.filter(descendant =>
		isViewableByUser(descendant, fetcher)
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
	emojis: Emoji[];
	content_type?: string;
	uri?: string;
	mentions?: User[];
	reply?: {
		status: Status;
		user: User;
	};
	quote?: Status;
}) => {
	// Get people mentioned in the content
	const mentionedPeople = [...data.content.matchAll(/@([a-zA-Z0-9_]+)/g)].map(
		match => {
			return `${config.http.base_url}/users/${match[1]}`;
		}
	);

	let mentions = data.mentions || [];

	// Get list of mentioned users
	if (mentions.length === 0) {
		mentions = await client.user.findMany({
			where: {
				OR: mentionedPeople.map(person => ({
					username: person.split("@")[1],
					instance: {
						base_url: person.split("@")[2],
					},
				})),
			},
			include: userRelations,
		});
	}

	const status = await client.status.create({
		data: {
			authorId: data.account.id,
			applicationId: data.application?.id,
			content: data.content,
			contentType: data.content_type,
			visibility: data.visibility,
			sensitive: data.sensitive,
			spoilerText: data.spoiler_text,
			emojis: {
				connect: data.emojis.map(emoji => {
					return {
						id: emoji.id,
					};
				}),
			},
			inReplyToPostId: data.reply?.status.id,
			quotingPostId: data.quote?.id,
			instanceId: data.account.instanceId || undefined,
			isReblog: false,
			uri: data.uri || `${config.http.base_url}/statuses/xxx`,
			mentions: {
				connect: mentions.map(mention => {
					return {
						id: mention.id,
					};
				}),
			},
		},
		include: statusAndUserRelations,
	});

	if (!data.uri) status.uri = `${config.http.base_url}/statuses/${status.id}`;

	return status;
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
	user?: UserWithRelations
): Promise<APIStatus> => {
	return {
		id: status.id,
		in_reply_to_id: status.inReplyToPostId || null,
		in_reply_to_account_id: status.inReplyToPost?.authorId || null,
		account: await userToAPI(status.author),
		created_at: new Date(status.createdAt).toISOString(),
		application: status.application
			? await applicationToAPI(status.application)
			: null,
		card: null,
		content: status.content,
		emojis: await Promise.all(
			status.emojis.map(emoji => emojiToAPI(emoji))
		),
		favourited: !!status.likes.find(like => like.likerId === user?.id),
		favourites_count: status.likes.length,
		media_attachments: [],
		mentions: [],
		language: null,
		muted: user
			? user.relationships.find(r => r.subjectId == status.authorId)
					?.muting || false
			: false,
		pinned: status.author.pinnedNotes.some(note => note.id === status.id),
		// TODO: Add pols
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
		reblogs_count: await client.status.count({
			where: {
				reblogId: status.id,
			},
		}),
		replies_count: status._count.replies,
		sensitive: status.sensitive,
		spoiler_text: status.spoilerText,
		tags: [],
		uri: `${config.http.base_url}/statuses/${status.id}`,
		visibility: "public",
		url: `${config.http.base_url}/statuses/${status.id}`,
		bookmarked: false,
		quote: null,
		quote_id: undefined,
	};
};

export const statusToLysand = (status: StatusWithRelations): Note => {
	return {
		type: "Note",
		created_at: new Date(status.createdAt).toISOString(),
		id: status.id,
		author: status.authorId,
		uri: `${config.http.base_url}/users/${status.authorId}/statuses/${status.id}`,
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
		mentions: status.mentions.map(mention => mention.uri),
		quotes: status.quotingPost ? [status.quotingPost.uri] : [],
		replies_to: status.inReplyToPostId ? [status.inReplyToPostId] : [],
		subject: status.spoilerText,
		extensions: {
			"org.lysand:custom_emojis": {
				emojis: status.emojis.map(emoji => emojiToLysand(emoji)),
			},
			// TODO: Add polls and reactions
		},
	};
};
