import { Account } from "./account";

export interface Report {
	id: string;
	action_taken: boolean;
	action_taken_at: string | null;
	category: Category;
	comment: string;
	forwarded: boolean;
	status_ids: string[] | null;
	rule_ids: string[] | null;
	target_account: Account;
}

export type Category = "spam" | "violation" | "other";
