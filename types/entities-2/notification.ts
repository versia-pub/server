import type { APIAccount } from "./account";
import type { APIStatus } from "./status";

export interface APINotification {
    account: APIAccount;
    created_at: string;
    id: string;
    status?: APIStatus;
    type: APINotificationType;
}

export type APINotificationType = string;
