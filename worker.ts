import type { Entity } from "@versia/federation/types";
import { Note } from "@versia/kit/db";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "./packages/config-manager/index.ts";

const connection = new IORedis({
    host: config.redis.queue.host,
    port: config.redis.queue.port,
    password: config.redis.queue.password,
    db: config.redis.queue.database,
});

enum DeliveryJobType {
    FederateNote = "federateNote",
}

enum InboxJobType {
    ProcessEntity = "processEntity",
}

const deliveryQueue = new Queue<{ noteId: string }, void, DeliveryJobType>(
    "delivery",
    {
        connection,
    },
);

export const inboxQueue = new Queue<{ data: Entity }, void, InboxJobType>(
    "inbox",
    {
        connection,
    },
);

export const worker = new Worker<{ noteId: string }, void, DeliveryJobType>(
    deliveryQueue.name,
    async (job) => {
        switch (job.name) {
            case DeliveryJobType.FederateNote: {
                const noteId = job.data.noteId;

                const note = await Note.fromId(noteId);

                if (!note) {
                    throw new Error(`Note with ID ${noteId} not found`);
                }

                await note.federateToUsers();
            }
        }
    },
    { connection },
);
