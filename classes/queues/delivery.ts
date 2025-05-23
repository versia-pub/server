import { User } from "@versia/kit/db";
import { Queue, Worker } from "bullmq";
import chalk from "chalk";
import { config } from "~/config.ts";
import * as VersiaEntities from "~/packages/sdk/entities";
import type { JSONObject } from "~/packages/sdk/types";
import { connection } from "~/utils/redis.ts";

export enum DeliveryJobType {
    FederateEntity = "federateEntity",
}

export type DeliveryJobData = {
    entity: JSONObject;
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
                            `Could not resolve sender ID ${chalk.gray(
                                senderId,
                            )}`,
                        );
                    }

                    const recipient = await User.fromId(recipientId);

                    if (!recipient) {
                        throw new Error(
                            `Could not resolve recipient ID ${chalk.gray(
                                recipientId,
                            )}`,
                        );
                    }

                    await job.log(
                        `Federating entity [${
                            entity.id
                        }] from @${sender.getAcct()} to @${recipient.getAcct()}`,
                    );

                    const type = entity.type;
                    const entityCtor = Object.values(VersiaEntities).find(
                        (ctor) => ctor.name === type,
                    ) as typeof VersiaEntities.Entity | undefined;

                    if (!entityCtor) {
                        throw new Error(
                            `Could not resolve entity type ${chalk.gray(
                                type,
                            )} for entity [${entity.id}]`,
                        );
                    }

                    await sender.federateToUser(
                        await entityCtor.fromJSON(entity),
                        recipient,
                    );

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
