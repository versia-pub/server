import { getLogger } from "@logtape/logtape";
import { Instance, User } from "@versia/kit/db";
import { Worker } from "bullmq";
import { config } from "~/config.ts";
import { connection } from "~/utils/redis.ts";
import { InboxProcessor } from "../inbox/processor.ts";
import {
    type InboxJobData,
    InboxJobType,
    inboxQueue,
} from "../queues/inbox.ts";

export const getInboxWorker = (): Worker<InboxJobData, void, InboxJobType> =>
    new Worker<InboxJobData, void, InboxJobType>(
        inboxQueue.name,
        async (job) => {
            switch (job.name) {
                case InboxJobType.ProcessEntity: {
                    const { data, headers, request, ip } = job.data;

                    await job.log(`Processing entity [${data.id}]`);

                    if (headers.authorization) {
                        const processor = new InboxProcessor(
                            {
                                ...request,
                                url: new URL(request.url),
                            },
                            data,
                            null,
                            {
                                authorization: headers.authorization,
                            },
                            getLogger(["federation", "inbox"]),
                            ip,
                        );

                        await job.log(
                            `Entity [${data.id}] is potentially from a bridge`,
                        );

                        const output = await processor.process();

                        if (output instanceof Response) {
                            // Error occurred
                            const error = await output.json();
                            await job.log(`Error during processing: ${error}`);

                            await job.log(
                                `Failed processing entity [${data.id}]`,
                            );

                            return;
                        }

                        await job.log(
                            `✔ Finished processing entity [${data.id}]`,
                        );

                        return;
                    }

                    const {
                        "versia-signature": signature,
                        "versia-signed-at": signedAt,
                        "versia-signed-by": signedBy,
                    } = headers as {
                        "versia-signature": string;
                        "versia-signed-at": number;
                        "versia-signed-by": string;
                    };

                    const sender = await User.resolve(new URL(signedBy));

                    if (!(sender || signedBy.startsWith("instance "))) {
                        await job.log(
                            `Could not resolve sender URI [${signedBy}]`,
                        );

                        return;
                    }

                    if (sender?.isLocal()) {
                        throw new Error(
                            "Cannot process federation requests from local users",
                        );
                    }

                    const remoteInstance = sender
                        ? await Instance.fromUser(sender)
                        : await Instance.resolveFromHost(
                              signedBy.split(" ")[1],
                          );

                    if (!remoteInstance) {
                        await job.log("Could not resolve the remote instance.");

                        return;
                    }

                    await job.log(
                        `Entity [${data.id}] is from remote instance [${remoteInstance.data.baseUrl}]`,
                    );

                    if (!remoteInstance.data.publicKey?.key) {
                        throw new Error(
                            `Instance ${remoteInstance.data.baseUrl} has no public key stored in database`,
                        );
                    }

                    const processor = new InboxProcessor(
                        {
                            ...request,
                            url: new URL(request.url),
                        },
                        data,
                        {
                            instance: remoteInstance,
                            key:
                                sender?.data.publicKey ??
                                remoteInstance.data.publicKey.key,
                        },
                        {
                            signature,
                            signedAt: new Date(signedAt * 1000),
                            authorization: undefined,
                        },
                        getLogger(["federation", "inbox"]),
                        ip,
                    );

                    const output = await processor.process();

                    if (output instanceof Response) {
                        // Error occurred
                        const error = await output.json();
                        await job.log(`Error during processing: ${error}`);

                        await job.log(`Failed processing entity [${data.id}]`);

                        await job.log(
                            `Sending error message to instance [${remoteInstance.data.baseUrl}]`,
                        );

                        await remoteInstance.sendMessage(
                            `Failed processing entity [${data.uri}] delivered to inbox. Returned error:\n\n${JSON.stringify(
                                error,
                                null,
                                4,
                            )}`,
                        );

                        await job.log("Message sent");

                        return;
                    }

                    await job.log(`Finished processing entity [${data.id}]`);

                    return;
                }

                default: {
                    throw new Error(`Unknown job type: ${job.name}`);
                }
            }
        },
        {
            connection,
            removeOnComplete: {
                age: config.queues.inbox?.remove_after_complete_seconds,
            },
            removeOnFail: {
                age: config.queues.inbox?.remove_after_failure_seconds,
            },
        },
    );
