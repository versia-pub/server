import { config } from "@versia-server/config";
import { Note, setupDatabase } from "@versia-server/kit/db";
import { connection } from "@versia-server/kit/redis";
import { searchManager } from "@versia-server/kit/search";
import { serverLogger } from "@versia-server/logging";

const timeAtStart = performance.now();

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
