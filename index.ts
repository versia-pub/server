import { checkConfig } from "@/init";
import { dualLogger } from "@/loggers";
import { connectMeili } from "@/meilisearch";
import { errorResponse, response } from "@/response";
import { config } from "config-manager";
import { Hono } from "hono";
import { LogLevel, LogManager, type MultiLogManager } from "log-manager";
import { setupDatabase } from "~/drizzle/db";
import { agentBans } from "~/middlewares/agent-bans";
import { bait } from "~/middlewares/bait";
import { boundaryCheck } from "~/middlewares/boundary-check";
import { ipBans } from "~/middlewares/ip-bans";
import { logger } from "~/middlewares/logger";
import { Note } from "~/packages/database-interface/note";
import { handleGlitchRequest } from "~/packages/glitch-server/main";
import { routes } from "~/routes";
import { createServer } from "~/server";
import type { ApiRouteExports } from "~/types/api";

const timeAtStart = performance.now();

const isEntry =
    import.meta.path === Bun.main && !process.argv.includes("--silent");

let dualServerLogger: LogManager | MultiLogManager = new LogManager(
    Bun.file("/dev/null"),
);

if (isEntry) {
    dualServerLogger = dualLogger;
}

await dualServerLogger.log(LogLevel.Info, "Lysand", "Starting Lysand...");

await setupDatabase(dualServerLogger);

if (config.meilisearch.enabled) {
    await connectMeili(dualServerLogger);
}

process.on("SIGINT", () => {
    process.exit();
});

// Check if database is reachable
const postCount = await Note.getCount();

if (isEntry) {
    await checkConfig(config, dualServerLogger);
}

const app = new Hono({
    strict: false,
});

app.use(ipBans);
app.use(agentBans);
app.use(bait);
app.use(logger);
app.use(boundaryCheck);
// Disabled as federation now checks for this
// app.use(urlCheck);

// Inject own filesystem router
for (const [, path] of Object.entries(routes)) {
    // use app.get(path, handler) to add routes
    const route: ApiRouteExports = await import(path);

    if (!(route.meta && route.default)) {
        throw new Error(`Route ${path} does not have the correct exports.`);
    }

    route.default(app);
}

app.options("*", () => {
    return response(null);
});

app.all("*", async (context) => {
    if (config.frontend.glitch.enabled) {
        const glitch = await handleGlitchRequest(context.req.raw, dualLogger);

        if (glitch) {
            return glitch;
        }
    }

    const replacedUrl = new URL(
        new URL(context.req.url).pathname,
        config.frontend.url,
    ).toString();

    await dualLogger.log(
        LogLevel.Debug,
        "Server.Proxy",
        `Proxying ${replacedUrl}`,
    );

    const proxy = await fetch(replacedUrl, {
        headers: {
            // Include for SSR
            "X-Forwarded-Host": `${config.http.bind}:${config.http.bind_port}`,
            "Accept-Encoding": "identity",
        },
        redirect: "manual",
    }).catch(async (e) => {
        await dualLogger.logError(LogLevel.Error, "Server.Proxy", e as Error);
        await dualLogger.log(
            LogLevel.Error,
            "Server.Proxy",
            `The Frontend is not running or the route is not found: ${replacedUrl}`,
        );
        return null;
    });

    proxy?.headers.set("Cache-Control", "max-age=31536000");

    if (!proxy || proxy.status === 404) {
        return errorResponse(
            "Route not found on proxy or API route. Are you using the correct HTTP method?",
            404,
        );
    }

    return proxy;
});

createServer(config, app);

await dualServerLogger.log(
    LogLevel.Info,
    "Server",
    `Lysand started at ${config.http.bind}:${config.http.bind_port} in ${(performance.now() - timeAtStart).toFixed(0)}ms`,
);

await dualServerLogger.log(
    LogLevel.Info,
    "Database",
    `Database is online, now serving ${postCount} posts`,
);

if (config.frontend.enabled) {
    if (!URL.canParse(config.frontend.url)) {
        await dualServerLogger.log(
            LogLevel.Error,
            "Server",
            `Frontend URL is not a valid URL: ${config.frontend.url}`,
        );
        // Hang until Ctrl+C is pressed
        await Bun.sleep(Number.POSITIVE_INFINITY);
    }

    // Check if frontend is reachable
    const response = await fetch(new URL("/", config.frontend.url))
        .then((res) => res.ok)
        .catch(() => false);

    if (!response) {
        await dualServerLogger.log(
            LogLevel.Error,
            "Server",
            `Frontend is unreachable at ${config.frontend.url}`,
        );
        await dualServerLogger.log(
            LogLevel.Error,
            "Server",
            "Please ensure the frontend is online and reachable",
        );
    }
} else {
    await dualServerLogger.log(
        LogLevel.Warning,
        "Server",
        "Frontend is disabled, skipping check",
    );
}

export { app };
