import { config } from "config-manager";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";
import {
    LogLevel,
    type LogManager,
    type MultiLogManager,
} from "~packages/log-manager";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export const client = new Client({
    host: config.database.host,
    port: Number(config.database.port),
    user: config.database.username,
    password: config.database.password,
    database: config.database.database,
});

export const setupDatabase = async (logger: LogManager | MultiLogManager) => {
    try {
        await client.connect();
    } catch (e) {
        await logger.logError(LogLevel.CRITICAL, "Database", e as Error);

        await logger.log(
            LogLevel.CRITICAL,
            "Database",
            "Failed to connect to database. Please check your configuration.",
        );
        process.exit(1);
    }

    // Migrate the database
    await logger.log(LogLevel.INFO, "Database", "Migrating database...");

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

    await logger.log(LogLevel.INFO, "Database", "Database migrated");
};

export const db = drizzle(client, { schema });
