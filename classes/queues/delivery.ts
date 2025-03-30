import { User } from "@versia/kit/db";
import { Queue } from "bullmq";
import { Worker } from "bullmq";
import chalk from "chalk";
import { config } from "~/config.ts";
import type { KnownEntity } from "~/types/api";
import { connection } from "~/utils/redis.ts";

export enum DeliveryJobType {
    FederateEntity = "federateEntity",
}

export type DeliveryJobData = {
    entity: KnownEntity;
    recipientId: string;
    senderId: string;
};

export const deliveryQueue = new Queue<DeliveryJobData, void, DeliveryJobType>(
    "delivery",
    {
        connection,
    },
);

export const getDeliveryWorker = (): Worker<
    DeliveryJobData,
    void,
    DeliveryJobType
> =>
    new Worker<DeliveryJobData, void, DeliveryJobType>(
        deliveryQueue.name,
        async (job) => {
            switch (job.name) {
                case DeliveryJobType.FederateEntity: {
                    const { entity, recipientId, senderId } = job.data;

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

                    await job.log(
                        `Federating entity [${entity.id}] from @${sender.getAcct()} to @${recipient.getAcct()}`,
                    );

                    await sender.federateToUser(entity, recipient);

                    await job.log(
                        `✔ Finished federating entity [${entity.id}]`,
                    );
                }
            }
        },
        {
            connection,
            removeOnComplete: {
                age: config.queues.delivery?.remove_after_complete_seconds,
            },
            removeOnFail: {
                age: config.queues.delivery?.remove_after_failure_seconds,
            },
        },
    );
