import { PollOption } from "./poll_option";

export interface Poll {
	id: string;
	expires_at: string | null;
	expired: boolean;
	multiple: boolean;
	votes_count: number;
	options: PollOption[];
	voted: boolean;
}
