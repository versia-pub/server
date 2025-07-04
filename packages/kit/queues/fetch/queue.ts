import { Queue } from "bullmq";
import { connection } from "../../redis.ts";

export enum FetchJobType {
    Instance = "instance",
    User = "user",
    Note = "user",
}

export type FetchJobData = {
    uri: string;
    refetcher?: string;
};

export const fetchQueue = new Queue<FetchJobData, void, FetchJobType>("fetch", {
    connection,
});
