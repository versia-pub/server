import { dualLogger } from "@loggers";
import { connectMeili } from "@meilisearch";
import { config } from "config-manager";
import { count } from "drizzle-orm";
import { LogLevel, LogManager, type MultiLogManager } from "log-manager";
import { db, setupDatabase } from "~drizzle/db";
import { Notes } from "~drizzle/schema";
import { createServer } from "~server";

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
let postCount = 0;
try {
    postCount = (
        await db
            .select({
                count: count(),
            })
            .from(Notes)
    )[0].count;
} catch (e) {
    const error = e as Error;
    await dualServerLogger.logError(LogLevel.CRITICAL, "Database", error);
    process.exit(1);
}

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

const server = createServer(config, dualServerLogger, true);

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

export { config, server };
