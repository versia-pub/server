import { Queue } from "bullmq";
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
