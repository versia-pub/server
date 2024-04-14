import type { Account } from "./account";
import type { Application } from "./application";
import type { Attachment } from "./attachment";
import type { Card } from "./card";
import type { Emoji } from "./emoji";
import type { Mention } from "./mention";
import type { Poll } from "./poll";
import type { Reaction } from "./reaction";

export type Status = {
    id: string;
    uri: string;
    url: string;
    account: Account;
    in_reply_to_id: string | null;
    in_reply_to_account_id: string | null;
    reblog: Status | null;
    content: string;
    plain_content: string | null;
    created_at: string;
    edited_at: string | null;
    emojis: Emoji[];
    replies_count: number;
    reblogs_count: number;
    favourites_count: number;
    reblogged: boolean | null;
    favourited: boolean | null;
    muted: boolean | null;
    sensitive: boolean;
    spoiler_text: string;
    visibility: StatusVisibility;
    media_attachments: Array<Attachment>;
    mentions: Array<Mention>;
    tags: Array<StatusTag>;
    card: Card | null;
    poll: Poll | null;
    application: Application | null;
    language: string | null;
    pinned: boolean | null;
    emoji_reactions: Array<Reaction>;
    quote: boolean;
    bookmarked: boolean;
};

export type StatusTag = {
    name: string;
    url: string;
};

export type StatusVisibility = "public" | "unlisted" | "private" | "direct";
