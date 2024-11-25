import type { Entity } from "@versia/federation/types";
import { Queue } from "bullmq";
import type { SocketAddress } from "bun";
import { connection } from "~/utils/redis.ts";

export enum InboxJobType {
    ProcessEntity = "processEntity",
}

export type InboxJobData = {
    data: Entity;
    headers: {
        "x-signature"?: string;
        "x-nonce"?: string;
        "x-signed-by"?: string;
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
