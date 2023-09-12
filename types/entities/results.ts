import { APIAccount } from "./account";
import { APIStatus } from "./status";
import { APITag } from "./tag";

export interface APIResults {
	accounts: APIAccount[];
	statuses: APIStatus[];
	hashtags: APITag[];
}
