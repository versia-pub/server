import type { APIAccount } from "./account";
import type { APIStatus } from "./status";
import type { APITag } from "./tag";

export interface APIResults {
	accounts: APIAccount[];
	statuses: APIStatus[];
	hashtags: APITag[];
}
