import { sentry } from "@/sentry";
import { getLogger } from "@logtape/logtape";
import chalk from "chalk";
import { getDeliveryWorker } from "~/classes/workers/delivery";
import { getFetchWorker } from "~/classes/workers/fetch";
import { getInboxWorker } from "~/classes/workers/inbox";
import { getPushWorker } from "~/classes/workers/push";

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

serverLogger.info`${chalk.green("✔✔✔✔")} All workers started`;
