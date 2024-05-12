import { dualLogger } from "@loggers";
import { connectMeili } from "@meilisearch";
import { errorResponse, response } from "@response";
import { config } from "config-manager";
import { Hono } from "hono";
import { LogLevel, LogManager, type MultiLogManager } from "log-manager";
import { setupDatabase } from "~drizzle/db";
import { agentBans } from "~middlewares/agent-bans";
import { bait } from "~middlewares/bait";
import { boundaryCheck } from "~middlewares/boundary-check";
import { ipBans } from "~middlewares/ip-bans";
import { logger } from "~middlewares/logger";
import { Note } from "~packages/database-interface/note";
import { handleGlitchRequest } from "~packages/glitch-server/main";
import { routes } from "~routes";
import { createServer } from "~server";
import type { APIRouteExports } from "~types/api";

const timeAtStart = performance.now();

const isEntry = import.meta.path === Bun.main;

let dualServerLogger: LogManager | MultiLogManager = new LogManager(
    Bun.file("/dev/null"),
);

if (isEntry) {
    dualServerLogger = dualLogger;
}

await dualServerLogger.log(LogLevel.INFO, "Lysand", "Starting Lysand...");

await setupDatabase(dualServerLogger);

if (config.meilisearch.enabled) {
    await connectMeili(dualServerLogger);
}

// Check if database is reachable
const postCount = await Note.getCount();

if (isEntry) {
    // Check if JWT private key is set in config
    if (!config.oidc.jwt_key) {
        await dualServerLogger.log(
            LogLevel.CRITICAL,
            "Server",
            "The JWT private key is not set in the config",
        );
        await dualServerLogger.log(
            LogLevel.CRITICAL,
            "Server",
            "Below is a generated key for you to copy in the config at oidc.jwt_key",
        );
        // Generate a key for them
        const keys = await crypto.subtle.generateKey("Ed25519", true, [
            "sign",
            "verify",
        ]);

        const privateKey = Buffer.from(
            await crypto.subtle.exportKey("pkcs8", keys.privateKey),
        ).toString("base64");

        const publicKey = Buffer.from(
            await crypto.subtle.exportKey("spki", keys.publicKey),
        ).toString("base64");

        await dualServerLogger.log(
            LogLevel.CRITICAL,
            "Server",
            `${privateKey};${publicKey}`,
        );
        process.exit(1);
    }

    // Try and import the key
    const privateKey = await crypto.subtle
        .importKey(
            "pkcs8",
            Buffer.from(config.oidc.jwt_key.split(";")[0], "base64"),
            "Ed25519",
            false,
            ["sign"],
        )
        .catch((e) => e as Error);

    // Try and import the key
    const publicKey = await crypto.subtle
        .importKey(
            "spki",
            Buffer.from(config.oidc.jwt_key.split(";")[1], "base64"),
            "Ed25519",
            false,
            ["verify"],
        )
        .catch((e) => e as Error);

    if (privateKey instanceof Error || publicKey instanceof Error) {
        await dualServerLogger.log(
            LogLevel.CRITICAL,
            "Server",
            "The JWT key could not be imported! You may generate a new one by removing the old one from the config and restarting the server (this will invalidate all current JWTs).",
        );
        process.exit(1);
    }
}

const app = new Hono({
    strict: false,
});

app.use(ipBans);
app.use(agentBans);
app.use(bait);
app.use(logger);
app.use(boundaryCheck);

// Inject own filesystem router
for (const [route, path] of Object.entries(routes)) {
    // use app.get(path, handler) to add routes
    const route: APIRouteExports = await import(path);

    if (!route.meta || !route.default) {
        throw new Error(`Route ${path} does not have the correct exports.`);
    }

    route.default(app);
}

app.options("*", async () => {
    return response(null);
});

app.all("*", async (context) => {
    if (config.frontend.glitch.enabled) {
        const glitch = await handleGlitchRequest(context.req.raw, dualLogger);

        if (glitch) {
            return glitch;
        }
    }

    const base_url_with_http = config.http.base_url.replace(
        "https://",
        "http://",
    );

    const replacedUrl = context.req.url
        .replace(config.http.base_url, config.frontend.url)
        .replace(base_url_with_http, config.frontend.url);

    const proxy = await fetch(replacedUrl, {
        headers: {
            // Include for SSR
            "X-Forwarded-Host": `${config.http.bind}:${config.http.bind_port}`,
            "Accept-Encoding": "identity",
        },
    }).catch(async (e) => {
        await dualLogger.logError(LogLevel.ERROR, "Server.Proxy", e as Error);
        await dualLogger.log(
            LogLevel.ERROR,
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
    LogLevel.INFO,
    "Server",
    `Lysand started at ${config.http.bind}:${config.http.bind_port} in ${(
        performance.now() - timeAtStart
    ).toFixed(0)}ms`,
);

await dualServerLogger.log(
    LogLevel.INFO,
    "Database",
    `Database is online, now serving ${postCount} posts`,
);

if (config.frontend.enabled) {
    if (!URL.canParse(config.frontend.url)) {
        await dualServerLogger.log(
            LogLevel.ERROR,
            "Server",
            `Frontend URL is not a valid URL: ${config.frontend.url}`,
        );
        process.exit(1);
    }

    // Check if frontend is reachable
    const response = await fetch(new URL("/", config.frontend.url))
        .then((res) => res.ok)
        .catch(() => false);

    if (!response) {
        await dualServerLogger.log(
            LogLevel.ERROR,
            "Server",
            `Frontend is unreachable at ${config.frontend.url}`,
        );
        await dualServerLogger.log(
            LogLevel.ERROR,
            "Server",
            "Please ensure the frontend is online and reachable",
        );
    }
} else {
    await dualServerLogger.log(
        LogLevel.WARNING,
        "Server",
        "Frontend is disabled, skipping check",
    );
}

export { app };
