import { config } from "@versia-server/config";
import { Note, setupDatabase } from "@versia-server/kit/db";
import { connection } from "@versia-server/kit/redis";
import { serverLogger } from "@versia-server/logging";
import chalk from "chalk";
import { searchManager } from "../../classes/search/search-manager.ts";

const timeAtStart = performance.now();

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

if (config.search.enabled) {
    await searchManager.connect();
}

// Check if database is reachable
const postCount = await Note.getCount();

serverLogger.info`Versia Server Worker started at ${config.http.bind}:${config.http.bind_port} in ${(performance.now() - timeAtStart).toFixed(0)}ms`;

serverLogger.info`Database is online, containing ${postCount} posts`;

// Check if Redis is reachable
await connection.ping();

serverLogger.info`Redis is online`;
