import * as VersiaEntities from "@versia/sdk/entities";
import { config } from "@versia-server/config";
import { Worker } from "bullmq";
import chalk from "chalk";
import { User } from "../../db/user.ts";
import { connection } from "../../redis.ts";
import {
    type DeliveryJobData,
    DeliveryJobType,
    deliveryQueue,
} from "./queue.ts";

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
