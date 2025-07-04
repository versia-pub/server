import type { JSONObject } from "@versia/sdk";
import { Queue } from "bullmq";
import { connection } from "../../redis.ts";

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
