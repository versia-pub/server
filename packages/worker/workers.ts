import { getDeliveryWorker } from "~/classes/queues/delivery";
import { getFetchWorker } from "~/classes/queues/fetch";
import { getInboxWorker } from "~/classes/queues/inbox";
import { getMediaWorker } from "~/classes/queues/media";
import { getPushWorker } from "~/classes/queues/push";
import { getRelationshipWorker } from "~/classes/queues/relationships";

export const workers = {
    fetch: getFetchWorker,
    delivery: getDeliveryWorker,
    inbox: getInboxWorker,
    push: getPushWorker,
    media: getMediaWorker,
    relationship: getRelationshipWorker,
} as const;
