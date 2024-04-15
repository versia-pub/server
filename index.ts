import { connectMeili } from "@meilisearch";
import { config } from "config-manager";
import { count } from "drizzle-orm";
import { LogLevel, LogManager, type MultiLogManager } from "log-manager";
import { db, setupDatabase } from "~drizzle/db";
import { status } from "~drizzle/schema";
import { createServer } from "~server";

const timeAtStart = performance.now();

const isEntry = import.meta.path === Bun.main;

let dualLogger: LogManager | MultiLogManager = new LogManager(
    Bun.file("/dev/null"),
);

if (isEntry) {
    dualLogger = (await import("@loggers")).dualLogger;
}

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
    await dualLogger.logError(LogLevel.CRITICAL, "Database", error);
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

// Check if frontend is reachable
const response = await fetch(new URL("/", config.frontend.url))
    .then((res) => res.ok)
    .catch(() => false);

if (!response) {
    await dualLogger.log(
        LogLevel.ERROR,
        "Server",
        `Frontend is unreachable at ${config.frontend.url}`,
    );
    await dualLogger.log(
        LogLevel.ERROR,
        "Server",
        "Please ensure the frontend is online and reachable",
    );
}

export { config, server };
