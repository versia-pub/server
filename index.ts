import { configureLoggers } from "@/loggers";
import { sentry } from "@/sentry";
import { createServer } from "@/server";
import { config } from "config-manager";
import { appFactory } from "~/app";
import { setupDatabase } from "./drizzle/db";

if (import.meta.main) {
    await import("./setup");
    sentry?.captureMessage("Server started");
}

await setupDatabase();
await configureLoggers();

createServer(config, await appFactory());
