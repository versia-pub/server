import { getLogger } from "@logtape/logtape";
import chalk from "chalk";
import { sentry } from "@/sentry";
import { getDeliveryWorker } from "~/classes/queues/delivery";
import { getFetchWorker } from "~/classes/queues/fetch";
import { getInboxWorker } from "~/classes/queues/inbox";
import { getMediaWorker } from "~/classes/queues/media";
import { getPushWorker } from "~/classes/queues/push";
import { getRelationshipWorker } from "~/classes/queues/relationships";

process.on("SIGINT", () => {
    process.exit();
});

await import("~/entrypoints/worker/setup.ts");
sentry?.captureMessage("Server started", "info");

const serverLogger = getLogger("server");

serverLogger.info`Starting Fetch Worker...`;
getFetchWorker();
serverLogger.info`${chalk.green("✔")} Fetch Worker started`;

serverLogger.info`Starting Delivery Worker...`;
getDeliveryWorker();
serverLogger.info`${chalk.green("✔")} Delivery Worker started`;

serverLogger.info`Starting Inbox Worker...`;
getInboxWorker();
serverLogger.info`${chalk.green("✔")} Inbox Worker started`;

serverLogger.info`Starting Push Worker...`;
getPushWorker();
serverLogger.info`${chalk.green("✔")} Push Worker started`;

serverLogger.info`Starting Media Worker...`;
getMediaWorker();
serverLogger.info`${chalk.green("✔")} Media Worker started`;

serverLogger.info`Starting Relationship Worker...`;
getRelationshipWorker();
serverLogger.info`${chalk.green("✔")} Relationship Worker started`;

serverLogger.info`${chalk.green("✔✔✔✔✔✔")} All workers started`;
