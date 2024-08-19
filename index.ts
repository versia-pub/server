import { configureLoggers } from "@/loggers";
import { sentry } from "@/sentry";
import { createServer } from "@/server";
import { appFactory } from "~/app";
import { config } from "~/packages/config-manager/index";
import { setupDatabase } from "./drizzle/db";

if (import.meta.main) {
    await import("./setup");
    sentry?.captureMessage("Server started", "info");
}

await setupDatabase();
await configureLoggers();

createServer(config, await appFactory());
