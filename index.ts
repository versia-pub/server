import { connectMeili } from "@meilisearch";
import { config } from "config-manager";
import { count } from "drizzle-orm";
import { LogLevel, LogManager, MultiLogManager } from "log-manager";
import { db, setupDatabase } from "~drizzle/db";
import { status } from "~drizzle/schema";
import { createServer } from "~server";

const timeAtStart = performance.now();

const requests_log = Bun.file(config.logging.storage.requests);
const isEntry = import.meta.path === Bun.main;

const noColors = process.env.NO_COLORS === "true";
const noFancyDates = process.env.NO_FANCY_DATES === "true";

// If imported as a module, redirect logs to /dev/null to not pollute console (e.g. in tests)
const logger = new LogManager(isEntry ? requests_log : Bun.file("/dev/null"));
const consoleLogger = new LogManager(
    isEntry ? Bun.stdout : Bun.file("/dev/null"),
    !noColors,
    !noFancyDates,
);
const dualLogger = new MultiLogManager([logger, consoleLogger]);

await dualLogger.log(LogLevel.INFO, "Lysand", "Starting Lysand...");

await setupDatabase(dualLogger);

if (config.meilisearch.enabled) {
    await connectMeili(dualLogger);
}

// Check if database is reachable
let postCount = 0;
try {
    postCount = (
        await db
            .select({
                count: count(),
            })
            .from(status)
    )[0].count;
} catch (e) {
    const error = e as Error;
    await logger.logError(LogLevel.CRITICAL, "Database", error);
    await consoleLogger.logError(LogLevel.CRITICAL, "Database", error);
    process.exit(1);
}

const server = createServer(config, dualLogger, true);

await dualLogger.log(
    LogLevel.INFO,
    "Server",
    `Lysand started at ${config.http.bind}:${config.http.bind_port} in ${(
        performance.now() - timeAtStart
    ).toFixed(0)}ms`,
);

await dualLogger.log(
    LogLevel.INFO,
    "Database",
    `Database is online, now serving ${postCount} posts`,
);

export { config, server };
