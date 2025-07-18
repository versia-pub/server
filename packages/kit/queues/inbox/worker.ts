import { config } from "@versia-server/config";
import { Worker } from "bullmq";
import { ApiError } from "../../api-error.ts";
import { Instance } from "../../db/instance.ts";
import { User } from "../../db/user.ts";
import { InboxProcessor } from "../../inbox-processor.ts";
import { connection } from "../../redis.ts";
import { type InboxJobData, InboxJobType, inboxQueue } from "./queue.ts";

export const getInboxWorker = (): Worker<InboxJobData, void, InboxJobType> =>
    new Worker<InboxJobData, void, InboxJobType>(
        inboxQueue.name,
        async (job) => {
            switch (job.name) {
                case InboxJobType.ProcessEntity: {
                    const { data, headers, request, ip } = job.data;

                    await job.log(`Processing entity [${data.id}]`);

                    const req = new Request(request.url, {
                        method: request.method,
                        headers: new Headers(
                            Object.entries(headers)
                                .map(([k, v]) => [k, String(v)])
                                .concat([
                                    ["content-type", "application/json"],
                                ]) as [string, string][],
                        ),
                        body: request.body,
                    });

                    if (headers.authorization) {
                        try {
                            const processor = new InboxProcessor(
                                req,
                                data,
                                null,
                                headers.authorization,
                                ip,
                            );

                            await job.log(
                                `Entity [${data.id}] is potentially from a bridge`,
                            );

                            await processor.process();
                        } catch (e) {
                            if (e instanceof ApiError) {
                                // Error occurred
                                await job.log(
                                    `Error during processing: ${e.message}`,
                                );

                                await job.log(
                                    `Failed processing entity [${data.id}]`,
                                );

                                return;
                            }

                            throw e;
                        }

                        await job.log(
                            `✔ Finished processing entity [${data.id}]`,
                        );

                        return;
                    }

                    const { "versia-signed-by": signedBy } = headers as {
                        "versia-signed-by": string;
                    };

                    const sender = await User.resolve(new URL(signedBy));

                    if (!(sender || signedBy.startsWith("instance "))) {
                        await job.log(
                            `Could not resolve sender URI [${signedBy}]`,
                        );

                        return;
                    }

                    if (sender?.local) {
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

                    const key = await crypto.subtle.importKey(
                        "spki",
                        Buffer.from(
                            sender?.data.publicKey ??
                                remoteInstance.data.publicKey.key,
                            "base64",
                        ),
                        "Ed25519",
                        false,
                        ["verify"],
                    );

                    try {
                        const processor = new InboxProcessor(
                            req,
                            data,
                            {
                                instance: remoteInstance,
                                key,
                            },
                            undefined,
                            ip,
                        );

                        await processor.process();
                    } catch (e) {
                        if (e instanceof ApiError) {
                            // Error occurred
                            await job.log(
                                `Error during processing: ${e.message}`,
                            );

                            await job.log(
                                `Failed processing entity [${data.id}]`,
                            );

                            await job.log(
                                `Sending error message to instance [${remoteInstance.data.baseUrl}]`,
                            );

                            await remoteInstance.sendMessage(
                                `Failed processing entity [${
                                    data.uri
                                }] delivered to inbox. Returned error:\n\n${JSON.stringify(
                                    e.message,
                                    null,
                                    4,
                                )}`,
                            );

                            await job.log("Message sent");

                            return;
                        }

                        throw e;
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
