import { getDeliveryWorker } from "@versia-server/kit/queues/delivery/worker";
import { getFetchWorker } from "@versia-server/kit/queues/fetch/worker";
import { getInboxWorker } from "@versia-server/kit/queues/inbox/worker";
import { getMediaWorker } from "@versia-server/kit/queues/media/worker";
import { getPushWorker } from "@versia-server/kit/queues/push/worker";
import { getRelationshipWorker } from "@versia-server/kit/queues/relationships/worker";

export const workers = {
    fetch: getFetchWorker,
    delivery: getDeliveryWorker,
    inbox: getInboxWorker,
    push: getPushWorker,
    media: getMediaWorker,
    relationship: getRelationshipWorker,
} as const;
