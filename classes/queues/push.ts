import { Queue } from "bullmq";
import { connection } from "~/utils/redis.ts";

export enum PushJobType {
    Notify = "notify",
}

export type PushJobData = {
    psId: string;
    type: string;
    relatedUserId: string;
    noteId?: string;
    notificationId: string;
};

export const pushQueue = new Queue<PushJobData, void, PushJobType>("push", {
    connection,
});
