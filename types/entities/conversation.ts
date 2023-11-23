import type { APIAccount } from "./account";
import type { APIStatus } from "./status";

export interface APIConversation {
	id: string;
	accounts: APIAccount[];
	last_status: APIStatus | null;
	unread: boolean;
}
