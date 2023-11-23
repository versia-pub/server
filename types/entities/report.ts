import type { APIAccount } from "./account";

export interface APIReport {
	id: string;
	action_taken: boolean;
	action_taken_at: string | null;
	category: APICategory;
	comment: string;
	forwarded: boolean;
	status_ids: string[] | null;
	rule_ids: string[] | null;
	target_account: APIAccount;
}

export type APICategory = "spam" | "violation" | "other";
