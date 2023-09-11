import { Account } from "./account";
import { Status } from "./status";

export interface Conversation {
	id: string;
	accounts: Account[];
	last_status: Status | null;
	unread: boolean;
}
