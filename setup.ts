import { checkConfig } from "@/init";
import { configureLoggers } from "@/loggers";
import { getLogger } from "@logtape/logtape";
import { Note } from "@versia/kit/db";
import { setupDatabase } from "~/drizzle/db";
import { config } from "~/packages/config-manager/index.ts";
import { searchManager } from "./classes/search/search-manager.ts";

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

if (config.sonic.enabled) {
    await searchManager.connect();
}

// Check if database is reachable
const postCount = await Note.getCount();

await checkConfig(config);

serverLogger.info`Versia Server started at ${config.http.bind}:${config.http.bind_port} in ${(performance.now() - timeAtStart).toFixed(0)}ms`;

serverLogger.info`Database is online, now serving ${postCount} posts`;

if (config.frontend.enabled) {
    // Check if frontend is reachable
    const response = await fetch(new URL("/", config.frontend.url))
        .then((res) => res.ok)
        .catch(() => false);

    if (!response) {
        serverLogger.error`Frontend is unreachable at ${config.frontend.url}`;
        serverLogger.error`Please ensure the frontend is online and reachable`;
    }
} else {
    serverLogger.warn`Frontend is disabled, skipping check`;
}
