import { getLogger } from "@logtape/logtape";
import type { Entity } from "@versia/federation/types";
import { Instance, User } from "@versia/kit/db";
import { Queue, Worker } from "bullmq";
import type { SocketAddress } from "bun";
import chalk from "chalk";
import { eq } from "drizzle-orm";
import IORedis from "ioredis";
import { InboxProcessor } from "./classes/inbox/processor.ts";
import { Instances } from "./drizzle/schema.ts";
import { config } from "./packages/config-manager/index.ts";
import type { KnownEntity } from "./types/api.ts";

const connection = new IORedis({
    host: config.redis.queue.host,
    port: config.redis.queue.port,
    password: config.redis.queue.password,
    db: config.redis.queue.database,
    maxRetriesPerRequest: null,
});

export enum DeliveryJobType {
    FederateEntity = "federateEntity",
}

export enum InboxJobType {
    ProcessEntity = "processEntity",
}

export enum FetchJobType {
    Instance = "instance",
    User = "user",
    Note = "user",
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

export type DeliveryJobData = {
    entity: KnownEntity;
    recipientId: string;
    senderId: string;
};

export type FetchJobData = {
    uri: string;
    refetcher?: string;
};

export const deliveryQueue = new Queue<DeliveryJobData, void, DeliveryJobType>(
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

export const fetchQueue = new Queue<FetchJobData, void, FetchJobType>("fetch", {
    connection,
});

export const deliveryWorker = new Worker<
    DeliveryJobData,
    void,
    DeliveryJobType
>(
    deliveryQueue.name,
    async (job) => {
        switch (job.name) {
            case DeliveryJobType.FederateEntity: {
                const { entity, recipientId, senderId } = job.data;

                const logger = getLogger(["federation", "delivery"]);

                const sender = await User.fromId(senderId);

                if (!sender) {
                    throw new Error(
                        `Could not resolve sender ID ${chalk.gray(senderId)}`,
                    );
                }

                const recipient = await User.fromId(recipientId);

                if (!recipient) {
                    throw new Error(
                        `Could not resolve recipient ID ${chalk.gray(recipientId)}`,
                    );
                }

                logger.debug`Federating entity ${chalk.gray(
                    entity.id,
                )} from ${chalk.gray(`@${sender.getAcct()}`)} to ${chalk.gray(
                    recipient.getAcct(),
                )}`;

                await sender.federateToUser(entity, recipient);

                logger.debug`${chalk.green(
                    "✔",
                )} Finished federating entity ${chalk.gray(entity.id)}`;
            }
        }
    },
    {
        connection,
        removeOnComplete: {
            age: config.queues.delivery.remove_on_complete,
        },
        removeOnFail: {
            age: config.queues.delivery.remove_on_failure,
        },
    },
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

                logger.debug`Processing entity ${chalk.gray(
                    data.id,
                )} from ${chalk.gray(signedBy)}`;

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

                    logger.debug`Entity ${chalk.gray(
                        data.id,
                    )} is potentially from a bridge`;

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

                logger.debug`Entity ${chalk.gray(
                    data.id,
                )} is from remote instance ${chalk.gray(
                    remoteInstance.data.baseUrl,
                )}`;

                if (!remoteInstance.data.publicKey?.key) {
                    throw new Error(
                        `Instance ${remoteInstance.data.baseUrl} has no public key stored in database`,
                    );
                }

                const processor = new InboxProcessor(
                    request,
                    data,
                    {
                        instance: remoteInstance,
                        key:
                            sender?.data.publicKey ??
                            remoteInstance.data.publicKey.key,
                    },
                    {
                        signature,
                        nonce,
                        authorization,
                    },
                    logger,
                    ip,
                );

                const output = await processor.process();

                logger.debug`${chalk.green(
                    "✔",
                )} Finished processing entity ${chalk.gray(data.id)}`;

                return output;
            }

            default: {
                throw new Error(`Unknown job type: ${job.name}`);
            }
        }
    },
    {
        connection,
        removeOnComplete: {
            age: config.queues.inbox.remove_on_complete,
        },
        removeOnFail: {
            age: config.queues.inbox.remove_on_failure,
        },
    },
);

export const fetchWorker = new Worker<FetchJobData, void, FetchJobType>(
    fetchQueue.name,
    async (job) => {
        switch (job.name) {
            case FetchJobType.Instance: {
                const { uri } = job.data;

                await job.log(`Fetching instance metadata from [${uri}]`);

                // Check if exists
                const host = new URL(uri).host;

                const existingInstance = await Instance.fromSql(
                    eq(Instances.baseUrl, host),
                );

                if (existingInstance) {
                    await job.log("Instance is known, refetching remote data.");

                    await existingInstance.updateFromRemote();

                    await job.log(`Instance [${uri}] successfully refetched`);

                    return;
                }

                await Instance.resolve(uri);

                await job.log(
                    `${chalk.green(
                        "✔",
                    )} Finished fetching instance metadata from [${uri}]`,
                );
            }
        }
    },
    {
        connection,
        removeOnComplete: {
            age: config.queues.fetch.remove_on_complete,
        },
        removeOnFail: {
            age: config.queues.fetch.remove_on_failure,
        },
    },
);
