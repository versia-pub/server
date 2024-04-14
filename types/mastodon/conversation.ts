import type { Account } from "./account";
import type { Status } from "./status";

export type Conversation = {
    id: string;
    accounts: Array<Account>;
    last_status: Status | null;
    unread: boolean;
};
