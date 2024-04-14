import type { APIPollOption } from "./poll_option";

export interface APIPoll {
    id: string;
    expires_at: string | null;
    expired: boolean;
    multiple: boolean;
    votes_count: number;
    options: APIPollOption[];
    voted: boolean;
}
