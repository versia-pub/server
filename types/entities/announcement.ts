import { Emoji } from "./emoji";
import { StatusTag } from "./status";

export interface Announcement {
	id: string;
	content: string;
	starts_at: string | null;
	ends_at: string | null;
	published: boolean;
	all_day: boolean;
	published_at: string;
	updated_at: string;
	read: boolean | null;
	mentions: AnnouncementAccount[];
	statuses: AnnouncementStatus[];
	tags: StatusTag[];
	emojis: Emoji[];
	reactions: AnnouncementReaction[];
}

export interface AnnouncementAccount {
	id: string;
	username: string;
	url: string;
	acct: string;
}

export interface AnnouncementStatus {
	id: string;
	url: string;
}

export interface AnnouncementReaction {
	name: string;
	count: number;
	me: boolean | null;
	url: string | null;
	static_url: string | null;
}
