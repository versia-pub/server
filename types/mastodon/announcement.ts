import type { Emoji } from "./emoji";
import type { StatusTag } from "./status";

export type Announcement = {
    id: string;
    content: string;
    starts_at: string | null;
    ends_at: string | null;
    published: boolean;
    all_day: boolean;
    published_at: string;
    updated_at: string | null;
    read: boolean | null;
    mentions: AnnouncementAccount[];
    statuses: AnnouncementStatus[];
    tags: StatusTag[];
    emojis: Emoji[];
    reactions: AnnouncementReaction[];
};

export type AnnouncementAccount = {
    id: string;
    username: string;
    url: string;
    acct: string;
};

export type AnnouncementStatus = {
    id: string;
    url: string;
};

export type AnnouncementReaction = {
    name: string;
    count: number;
    me: boolean | null;
    url: string | null;
    static_url: string | null;
};
