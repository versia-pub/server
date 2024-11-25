import { getLogger } from "@logtape/logtape";
import { Instance, User } from "@versia/kit/db";
import { Worker } from "bullmq";
import chalk from "chalk";
import { config } from "~/packages/config-manager/index.ts";
import { connection } from "~/utils/redis.ts";
import { InboxProcessor } from "../inbox/processor.ts";
import {
    type InboxJobData,
    InboxJobType,
    inboxQueue,
} from "../queues/inbox.ts";

export const getInboxWorker = (): Worker<
    InboxJobData,
    Response,
    InboxJobType
> =>
    new Worker<InboxJobData, Response, InboxJobType>(
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
                            {
                                error: `Couldn't resolve sender URI ${signedBy}`,
                            },
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
                        : await Instance.resolveFromHost(
                              signedBy.split(" ")[1],
                          );

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
