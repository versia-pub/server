import cluster from "node:cluster";
import { sentry } from "@/sentry";
import { createServer } from "@/server";
import { appFactory } from "~/app";
import { config } from "~/packages/config-manager/index.ts";

process.on("SIGINT", () => {
    process.exit();
});

if (cluster.isPrimary) {
    for (let i = 0; i < Number(process.env.NUM_CPUS ?? 1); i++) {
        cluster.fork();
    }

    await import("~/entrypoints/api/setup.ts");
    sentry?.captureMessage("Server started", "info");
} else {
    createServer(config, await appFactory());
}
