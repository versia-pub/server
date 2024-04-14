export interface APIList {
    id: string;
    title: string;
    replies_policy: APIRepliesPolicy;
}

export type APIRepliesPolicy = "followed" | "list" | "none";
