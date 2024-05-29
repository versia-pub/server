import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { LogLevel, LogManager, type MultiLogManager } from "log-manager";
import { Client } from "pg";
import { config } from "~//packages/config-manager";
import * as schema from "./schema";

export const client = new Client({
    host: config.database.host,
    port: Number(config.database.port),
    user: config.database.username,
    password: config.database.password,
    database: config.database.database,
});

export const setupDatabase = async (
    logger: LogManager | MultiLogManager = new LogManager(Bun.stdout),
    info = true,
) => {
    try {
        await client.connect();
    } catch (e) {
        if (
            (e as Error).message ===
            "Client has already been connected. You cannot reuse a client."
        )
            return;

        await logger.logError(LogLevel.CRITICAL, "Database", e as Error);

        await logger.log(
            LogLevel.CRITICAL,
            "Database",
            "Failed to connect to database. Please check your configuration.",
        );
        process.exit(1);
    }

    // Migrate the database
    info &&
        (await logger.log(LogLevel.INFO, "Database", "Migrating database..."));

    try {
        await migrate(db, {
            migrationsFolder: "./drizzle",
        });
    } catch (e) {
        await logger.logError(LogLevel.CRITICAL, "Database", e as Error);
        await logger.log(
            LogLevel.CRITICAL,
            "Database",
            "Failed to migrate database. Please check your configuration.",
        );
        process.exit(1);
    }

    info && (await logger.log(LogLevel.INFO, "Database", "Database migrated"));
};

export const db = drizzle(client, { schema });
