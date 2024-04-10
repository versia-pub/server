export interface ContentFormat {
    [contentType: string]: {
        content: string;
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
    };
}

export interface Emoji {
    name: string;
    alt?: string;
    url: ContentFormat;
}

export interface Collections<T> {
    first: string;
    last: string;
    total_count: number;
    author: string;
    next?: string;
    prev?: string;
    items: T[];
}

export interface ActorPublicKeyData {
    public_key: string;
    actor: string;
}

export interface Entity {
    id: string;
    created_at: string;
    uri: string;
    type: string;
    extensions?: {
        "org.lysand:custom_emojis"?: {
            emojis: Emoji[];
        };
        [key: string]: object | undefined;
    };
}

export interface Publication extends Entity {
    type: "Note" | "Patch";
    author: string;
    content?: ContentFormat;
    attachments?: ContentFormat[];
    replies_to?: string;
    quotes?: string;
    mentions?: string[];
    subject?: string;
    is_sensitive?: boolean;
    visibility: Visibility;
    extensions?: Entity["extensions"] & {
        "org.lysand:reactions"?: {
            reactions: string;
        };
        "org.lysand:polls"?: {
            poll: {
                options: ContentFormat[];
                votes: number[];
                multiple_choice?: boolean;
                expires_at: string;
            };
        };
    };
}

export enum Visibility {
    Public = "public",
    Unlisted = "unlisted",
    Followers = "followers",
    Direct = "direct",
}

export interface Note extends Publication {
    type: "Note";
}

export interface Patch extends Publication {
    type: "Patch";
    patched_id: string;
    patched_at: string;
}

export interface User extends Entity {
    type: "User";
    id: string;
    uri: string;
    created_at: string;
    display_name?: string;
    username: string;
    avatar?: ContentFormat;
    header?: ContentFormat;
    indexable: boolean;
    public_key: ActorPublicKeyData;
    bio?: ContentFormat;
    fields?: Field[];
    featured: string;
    followers: string;
    following: string;
    likes: string;
    dislikes: string;
    inbox: string;
    outbox: string;
    extensions?: Entity["extensions"] & {
        "org.lysand:vanity"?: VanityExtension;
    };
}

export interface Field {
    key: ContentFormat;
    value: ContentFormat;
}

export interface Action extends Entity {
    type:
        | "Like"
        | "Dislike"
        | "Follow"
        | "FollowAccept"
        | "FollowReject"
        | "Announce"
        | "Undo";
    author: string;
}

export interface Like extends Action {
    type: "Like";
    object: string;
}

export interface Undo extends Action {
    type: "Undo";
    object: string;
}

export interface Dislike extends Action {
    type: "Dislike";
    object: string;
}

export interface Follow extends Action {
    type: "Follow";
    followee: string;
}

export interface FollowAccept extends Action {
    type: "FollowAccept";
    follower: string;
}

export interface FollowReject extends Action {
    type: "FollowReject";
    follower: string;
}

export interface Announce extends Action {
    type: "Announce";
    object: string;
}

// Specific extension types will extend from this
export interface Extension extends Entity {
    type: "Extension";
    extension_type: string;
}

export interface Reaction extends Extension {
    extension_type: "org.lysand:reactions/Reaction";
    object: string;
    content: string;
}

export interface Poll extends Extension {
    extension_type: "org.lysand:polls/Poll";
    options: ContentFormat[];
    votes: number[];
    multiple_choice?: boolean;
    expires_at: string;
}

export interface Vote extends Extension {
    extension_type: "org.lysand:polls/Vote";
    poll: string;
    option: number;
}

export interface VoteResult extends Extension {
    extension_type: "org.lysand:polls/VoteResult";
    poll: string;
    votes: number[];
}

export interface Report extends Extension {
    extension_type: "org.lysand:reports/Report";
    objects: string[];
    reason: string;
    comment?: string;
}

export interface VanityExtension {
    avatar_overlay?: ContentFormat;
    avatar_mask?: ContentFormat;
    background?: ContentFormat;
    audio?: ContentFormat;
    pronouns?: {
        [language: string]: (ShortPronoun | LongPronoun)[];
    };
    birthday?: string;
    location?: string;
    activitypub?: string;
}

export type ShortPronoun = string;

export interface LongPronoun {
    subject: string;
    object: string;
    dependent_possessive: string;
    independent_possessive: string;
    reflexive: string;
}

export interface ServerMetadata {
    type: "ServerMetadata";
    name: string;
    version: string;
    description?: string;
    website?: string;
    moderators?: string[];
    admins?: string[];
    logo?: ContentFormat;
    banner?: ContentFormat;
    supported_extensions: string[];
    extensions?: {
        [key: string]: object | undefined;
    };
}
