import { getLogger } from "@logtape/logtape";
import type { Entity } from "@versia/federation/types";
import { Instance, Note, User } from "@versia/kit/db";
import { Queue, Worker } from "bullmq";
import type { SocketAddress } from "bun";
import IORedis from "ioredis";
import { InboxProcessor } from "./classes/inbox/processor.ts";
import { config } from "./packages/config-manager/index.ts";

const connection = new IORedis({
    host: config.redis.queue.host,
    port: config.redis.queue.port,
    password: config.redis.queue.password,
    db: config.redis.queue.database,
    maxRetriesPerRequest: null,
});

export enum DeliveryJobType {
    FederateNote = "federateNote",
}

export enum InboxJobType {
    ProcessEntity = "processEntity",
}

type InboxJobData = {
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

const deliveryQueue = new Queue<{ noteId: string }, void, DeliveryJobType>(
    "delivery",
    {
        connection,
    },
);

export const inboxQueue = new Queue<InboxJobData, Response, InboxJobType>(
    "inbox",
    {
        connection,
    },
);

export const deliveryWorker = new Worker<
    { noteId: string },
    void,
    DeliveryJobType
>(
    deliveryQueue.name,
    async (job) => {
        switch (job.name) {
            case DeliveryJobType.FederateNote: {
                const noteId = job.data.noteId;

                const note = await Note.fromId(noteId);

                if (!note) {
                    throw new Error(
                        `Note with ID ${noteId} not found in database`,
                    );
                }

                await note.federateToUsers();
            }
        }
    },
    { connection },
);

export const inboxWorker = new Worker<InboxJobData, Response, InboxJobType>(
    inboxQueue.name,
    async (job) => {
        switch (job.name) {
            case InboxJobType.ProcessEntity: {
                const {
                    data,
                    headers: {
                        "x-signature": signature,
                        "x-nonce": nonce,
                        "x-signed-by": signedBy,
                        authorization,
                    },
                    request,
                    ip,
                } = job.data;

                const logger = getLogger(["federation", "inbox"]);

                if (authorization) {
                    const processor = new InboxProcessor(
                        request,
                        data,
                        null,
                        {
                            signature,
                            nonce,
                            authorization,
                        },
                        logger,
                        ip,
                    );

                    return await processor.process();
                }

                // If not potentially from bridge, check for required headers
                if (!(signature && nonce && signedBy)) {
                    return Response.json(
                        {
                            error: "Missing required headers: x-signature, x-nonce, or x-signed-by",
                        },
                        {
                            status: 400,
                        },
                    );
                }

                const sender = await User.resolve(signedBy);

                if (!(sender || signedBy.startsWith("instance "))) {
                    return Response.json(
                        { error: `Couldn't resolve sender URI ${signedBy}` },
                        {
                            status: 404,
                        },
                    );
                }

                if (sender?.isLocal()) {
                    return Response.json(
                        {
                            error: "Cannot process federation requests from local users",
                        },
                        {
                            status: 400,
                        },
                    );
                }

                const remoteInstance = sender
                    ? await Instance.fromUser(sender)
                    : await Instance.resolveFromHost(signedBy.split(" ")[1]);

                if (!remoteInstance) {
                    return Response.json(
                        { error: "Could not resolve the remote instance." },
                        {
                            status: 500,
                        },
                    );
                }

                const processor = new InboxProcessor(
                    request,
                    data,
                    remoteInstance,
                    {
                        signature,
                        nonce,
                        authorization,
                    },
                    logger,
                    ip,
                );

                return await processor.process();
            }

            default: {
                throw new Error(`Unknown job type: ${job.name}`);
            }
        }
    },
    { connection },
);
