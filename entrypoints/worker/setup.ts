import { checkConfig } from "@/init";
import { configureLoggers } from "@/loggers";
import { getLogger } from "@logtape/logtape";
import { Note } from "@versia/kit/db";
import chalk from "chalk";
import IORedis from "ioredis";
import { setupDatabase } from "~/drizzle/db";
import { config } from "~/packages/config-manager/index.ts";
import { searchManager } from "../../classes/search/search-manager.ts";

const timeAtStart = performance.now();

await configureLoggers();

const serverLogger = getLogger("server");

console.info(`
██╗   ██╗███████╗██████╗ ███████╗██╗ █████╗ 
██║   ██║██╔════╝██╔══██╗██╔════╝██║██╔══██╗
██║   ██║█████╗  ██████╔╝███████╗██║███████║
╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██║██╔══██║
 ╚████╔╝ ███████╗██║  ██║███████║██║██║  ██║
  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═╝
             ${chalk.redBright.bold("** WORKER MODE **")}
`);

serverLogger.info`Starting Versia Server Worker...`;

await setupDatabase();

if (config.sonic.enabled) {
    await searchManager.connect();
}

// Check if database is reachable
const postCount = await Note.getCount();

await checkConfig(config);

serverLogger.info`Versia Server Worker started at ${config.http.bind}:${config.http.bind_port} in ${(performance.now() - timeAtStart).toFixed(0)}ms`;

serverLogger.info`Database is online, containing ${postCount} posts`;

// Check if Redis is reachable
const connection = new IORedis({
    host: config.redis.queue.host,
    port: config.redis.queue.port,
    password: config.redis.queue.password,
    db: config.redis.queue.database,
    maxRetriesPerRequest: null,
});

await connection.ping();

serverLogger.info`Redis is online`;
