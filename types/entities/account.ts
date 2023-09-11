import { Emoji } from "./emoji";
import { Field } from "./field";
import { Role } from "./role";
import { Source } from "./source";

export interface Account {
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
	emojis: Emoji[];
	moved: Account | null;
	fields: Field[];
	bot: boolean;
	source?: Source;
	role?: Role;
	mute_expires_at?: string;
}
