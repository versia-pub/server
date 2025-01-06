import { Queue } from "bullmq";
import { connection } from "~/utils/redis.ts";

export enum MediaJobType {
    ConvertMedia = "convertMedia",
}

export type MediaJobData = {
    attachmentId: string;
    filename: string;
};

export const mediaQueue = new Queue<MediaJobData, void, MediaJobType>("media", {
    connection,
});
