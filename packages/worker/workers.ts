import { getDeliveryWorker } from "@versia-server/kit/queues/delivery";
import { getFetchWorker } from "@versia-server/kit/queues/fetch";
import { getInboxWorker } from "@versia-server/kit/queues/inbox";
import { getMediaWorker } from "@versia-server/kit/queues/media";
import { getPushWorker } from "@versia-server/kit/queues/push";
import { getRelationshipWorker } from "@versia-server/kit/queues/relationships";

export const workers = {
    fetch: getFetchWorker,
    delivery: getDeliveryWorker,
    inbox: getInboxWorker,
    push: getPushWorker,
    media: getMediaWorker,
    relationship: getRelationshipWorker,
} as const;
