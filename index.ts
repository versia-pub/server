import { exists, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { connectMeili } from "@meilisearch";
import { moduleIsEntry } from "@module";
import { initializeRedisCache } from "@redis";
import { config } from "config-manager";
import { count, sql } from "drizzle-orm";
import { LogLevel, LogManager, MultiLogManager } from "log-manager";
import { db, client as pgClient } from "~drizzle/db";
import { status } from "~drizzle/schema";
import { createServer } from "~server";

await pgClient.connect();
const timeAtStart = performance.now();

// Create requests file if it doesnt exist
if (
    !(await exists(
        `${process.cwd()}/${dirname(config.logging.storage.requests)}`,
    ))
) {
    await mkdir(`${process.cwd()}/${dirname(config.logging.storage.requests)}`);
    await writeFile(`${process.cwd()}/${config.logging.storage.requests}`, "");
}
const requests_log = Bun.file(
    `${process.cwd()}/${config.logging.storage.requests}`,
);
const isEntry = moduleIsEntry(import.meta.url);
// If imported as a module, redirect logs to /dev/null to not pollute console (e.g. in tests)
const logger = new LogManager(isEntry ? requests_log : Bun.file("/dev/null"));
const consoleLogger = new LogManager(
    isEntry ? Bun.stdout : Bun.file("/dev/null"),
);
const dualLogger = new MultiLogManager([logger, consoleLogger]);

await dualLogger.log(LogLevel.INFO, "Lysand", "Starting Lysand...");

// NODE_ENV seems to be broken and output `development` even when set to production, so use the flag instead
const isProd =
    process.env.NODE_ENV === "production" || process.argv.includes("--prod");

const redisCache = await initializeRedisCache();

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

const server = createServer(config, dualLogger, isProd);

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
