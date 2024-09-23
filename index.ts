import cluster from "node:cluster";
import { configureLoggers } from "@/loggers";
import { sentry } from "@/sentry";
import { createServer } from "@/server";
import { appFactory } from "~/app";
import { config } from "~/packages/config-manager/index";

await configureLoggers();

if (cluster.isPrimary) {
    for (let i = 0; i < Number(process.env.NUM_CPUS ?? 1); i++) {
        cluster.fork();
    }
    await import("./setup");
    sentry?.captureMessage("Server started", "info");
} else {
    createServer(config, await appFactory());
}
