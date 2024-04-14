import type { APIEmoji } from "./emoji";
import type { APIField } from "./field";
import type { APIRole } from "./role";
import type { APISource } from "./source";

export interface APIAccount {
    id: string;
    username: string;
    acct: string;
    display_name: string;
    locked: boolean;
    discoverable?: boolean;
    group: boolean | null;
    noindex: boolean | null;
    suspended: boolean | null;
    limited: boolean | null;
    created_at: string;
    followers_count: number;
    following_count: number;
    statuses_count: number;
    note: string;
    url: string;
    avatar: string;
    avatar_static: string;
    header: string;
    header_static: string;
    emojis: APIEmoji[];
    moved: APIAccount | null;
    fields: APIField[];
    bot: boolean;
    source?: APISource;
    role?: APIRole;
    mute_expires_at?: string;
    pleroma?: object;
}
