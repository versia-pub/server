import { getLogger } from "@logtape/logtape";
import { Note } from "@versia/kit/db";
import { configureLoggers } from "@/loggers";
import { connection } from "@/redis.ts";
import { config } from "~/config.ts";
import { setupDatabase } from "~/drizzle/db";
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
`);

serverLogger.info`Starting Versia Server...`;

await setupDatabase();

if (config.search.enabled) {
    await searchManager.connect();
}

// Check if database is reachable
const postCount = await Note.getCount();

serverLogger.info`Versia Server started at ${config.http.bind}:${config.http.bind_port} in ${(performance.now() - timeAtStart).toFixed(0)}ms`;

serverLogger.info`Database is online, now serving ${postCount} posts`;

// Check if Redis is reachable
await connection.ping();

serverLogger.info`Redis is online`;
