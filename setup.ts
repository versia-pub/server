import { checkConfig } from "@/init";
import { configureLoggers } from "@/loggers";
import { getLogger } from "@logtape/logtape";
import { setupDatabase } from "~/drizzle/db";
import { config } from "~/packages/config-manager/index";
import { Note } from "~/packages/database-interface/note";
import { searchManager } from "./classes/search/search-manager";

const timeAtStart = performance.now();

await configureLoggers();

const serverLogger = getLogger("server");

serverLogger.info`Starting Versia Server...`;

await setupDatabase();

if (config.sonic.enabled) {
    await searchManager.connect();
}

process.on("SIGINT", () => {
    process.exit();
});

// Check if database is reachable
const postCount = await Note.getCount();

await checkConfig(config);

serverLogger.info`Versia Server started at ${config.http.bind}:${config.http.bind_port} in ${(performance.now() - timeAtStart).toFixed(0)}ms`;

serverLogger.info`Database is online, now serving ${postCount} posts`;

if (config.frontend.enabled) {
    if (!URL.canParse(config.frontend.url)) {
        serverLogger.error`Frontend URL is not a valid URL: ${config.frontend.url}`;
        // Hang until Ctrl+C is pressed
        await Bun.sleep(Number.POSITIVE_INFINITY);
    }

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
