import type { Emoji } from "./extensions/org.lysand/custom_emojis";

export interface LysandObjectType {
	type: string;
	id: string; // Either a UUID or some kind of time-based UUID-compatible system
	uri: string; // URI to the note
	created_at: string;
	extensions?: {
		// Should be in the format
		// "organization:extension_name": value
		// Example: "org.joinmastodon:spoiler_text": "This is a spoiler!"
		"org.lysand:custom_emojis"?: {
			emojis: Emoji[];
		};
		"org.lysand:reactions"?: {
			reactions: string;
		};
		"org.lysand:polls"?: {
			poll: {
				options: ContentFormat[][];
				votes: number[];
				expires_at: string;
				multiple_choice: boolean;
			};
		};

		[key: string]: any;
	};
}

export interface ActorPublicKeyData {
	public_key: string;
	actor: string;
}

export interface Collection<T> {
	first: string;
	last: string;
	next?: string;
	prev?: string;
	items: T[];
}

export interface User extends LysandObjectType {
	type: "User";
	bio: ContentFormat[];

	inbox: string;
	outbox: string;
	followers: string;
	following: string;
	liked: string;
	disliked: string;
	featured: string;

	indexable: boolean;
	fields?: {
		key: ContentFormat[];
		value: ContentFormat[];
	}[];
	display_name?: string;
	public_key?: ActorPublicKeyData;
	username: string;
	avatar?: ContentFormat[];
	header?: ContentFormat[];
}

export interface LysandPublication extends LysandObjectType {
	type: "Note" | "Patch";
	author: string;
	contents: ContentFormat[];
	mentions: string[];
	replies_to: string[];
	quotes: string[];
	is_sensitive: boolean;
	subject: string;
	attachments: ContentFormat[][];
}

export interface LysandAction extends LysandObjectType {
	type:
		| "Like"
		| "Dislike"
		| "Follow"
		| "FollowAccept"
		| "FollowReject"
		| "Announce"
		| "Undo"
		| "Extension";
	author: string;
}

/**
 * A Note is a publication on the network, such as a post or comment
 */
export interface Note extends LysandPublication {
	type: "Note";
}

/**
 * A Patch is an edit to a Note
 */
export interface Patch extends LysandPublication {
	type: "Patch";
	patched_id: string;
	patched_at: string;
}

export interface Like extends LysandAction {
	type: "Like";
	object: string;
}

export interface Dislike extends LysandAction {
	type: "Dislike";
	object: string;
}

export interface Announce extends LysandAction {
	type: "Announce";
	object: string;
}

export interface Undo extends LysandAction {
	type: "Undo";
	object: string;
}

export interface Follow extends LysandAction {
	type: "Follow";
	followee: string;
}

export interface FollowAccept extends LysandAction {
	type: "FollowAccept";
	follower: string;
}

export interface FollowReject extends LysandAction {
	type: "FollowReject";
	follower: string;
}

export interface ServerMetadata extends LysandObjectType {
	type: "ServerMetadata";
	name: string;
	version?: string;
	description?: string;
	website?: string;
	moderators?: string[];
	admins?: string[];
	logo?: ContentFormat[];
	banner?: ContentFormat[];
	supported_extensions?: string[];
}

/**
 * Content format is an array of objects that contain the content and the content type.
 */
export interface ContentFormat {
	content: string;
	content_type: string;
	description?: string;
	size?: number;
	hash?: {
		md5?: string;
		sha1?: string;
		sha256?: string;
		sha512?: string;
		[key: string]: string | undefined;
	};
	blurhash?: string;
	fps?: number;
	width?: number;
	height?: number;
	duration?: number;
}
