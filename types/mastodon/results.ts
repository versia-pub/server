import type { Account } from "./account";
import type { Status } from "./status";
import type { Tag } from "./tag";

export type Results = {
    accounts: Array<Account>;
    statuses: Array<Status>;
    hashtags: Array<Tag>;
};
