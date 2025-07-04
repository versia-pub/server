import type { JSONObject } from "@versia/sdk";
import { Queue } from "bullmq";
import type { SocketAddress } from "bun";
import { connection } from "../../redis.ts";

export enum InboxJobType {
    ProcessEntity = "processEntity",
}

export type InboxJobData = {
    data: JSONObject;
    headers: {
        "versia-signature"?: string;
        "versia-signed-at"?: number;
        "versia-signed-by"?: string;
        authorization?: string;
    };
    request: {
        url: string;
        method: string;
        body: string;
    };
    ip: SocketAddress | null;
};

export const inboxQueue = new Queue<InboxJobData, Response, InboxJobType>(
    "inbox",
    {
        connection,
    },
);
