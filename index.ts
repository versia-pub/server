import type { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { initializeRedisCache } from "@redis";
import { connectMeili } from "@meilisearch";
import { ConfigManager } from "config-manager";
import { client } from "~database/datasource";
import { LogLevel, LogManager, MultiLogManager } from "log-manager";
import { moduleIsEntry } from "@module";
import { createServer } from "~server";

const timeAtStart = performance.now();

const configManager = new ConfigManager({});
const config = await configManager.getConfig();

const requests_log = Bun.file(process.cwd() + "/logs/requests.log");
const isEntry = moduleIsEntry(import.meta.url);
// If imported as a module, redirect logs to /dev/null to not pollute console (e.g. in tests)
const logger = new LogManager(isEntry ? requests_log : Bun.file(`/dev/null`));
const consoleLogger = new LogManager(
	isEntry ? Bun.stdout : Bun.file(`/dev/null`)
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

if (redisCache) {
	client.$use(redisCache);
}

// Check if database is reachable
let postCount = 0;
try {
	postCount = await client.status.count();
} catch (e) {
	const error = e as PrismaClientInitializationError;
	await logger.logError(LogLevel.CRITICAL, "Database", error);
	await consoleLogger.logError(LogLevel.CRITICAL, "Database", error);
	process.exit(1);
}

const server = createServer(config, configManager, dualLogger, isProd);

await dualLogger.log(
	LogLevel.INFO,
	"Server",
	`Lysand started at ${config.http.bind}:${config.http.bind_port} in ${(performance.now() - timeAtStart).toFixed(0)}ms`
);

await dualLogger.log(
	LogLevel.INFO,
	"Database",
	`Database is online, now serving ${postCount} posts`
);

export { config, server };
