import type { Account } from "./account";
import type { Status } from "./status";
import type { Tag } from "./tag";

export type Results = {
    accounts: Account[];
    statuses: Status[];
    hashtags: Tag[];
};
