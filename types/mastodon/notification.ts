import type { Account } from "./account";
import type { Reaction } from "./reaction";
import type { Status } from "./status";

export type Notification = {
    account: Account | null;
    created_at: string;
    id: string;
    status?: Status;
    reaction?: Reaction;
    type: NotificationType;
    target?: Account;
};

export type NotificationType = string;
