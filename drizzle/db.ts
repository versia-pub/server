import { getLogger } from "@logtape/logtape";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Client } from "pg";
import { config } from "~/packages/config-manager";
import * as schema from "./schema";

export const client = new Client({
    host: config.database.host,
    port: Number(config.database.port),
    user: config.database.username,
    password: config.database.password,
    database: config.database.database,
});

export const setupDatabase = async (info = true) => {
    const logger = getLogger("database");

    try {
        await client.connect();
    } catch (e) {
        if (
            (e as Error).message ===
            "Client has already been connected. You cannot reuse a client."
        ) {
            return;
        }

        logger.fatal`${e}`;
        logger.fatal`Failed to connect to database. Please check your configuration.`;

        // Hang until Ctrl+C is pressed
        await Bun.sleep(Number.POSITIVE_INFINITY);
    }

    // Migrate the database
    info && logger.info`Migrating database...`;

    try {
        await migrate(db, {
            migrationsFolder: "./drizzle/migrations",
        });
    } catch (e) {
        logger.fatal`${e}`;
        logger.fatal`Failed to migrate database. Please check your configuration.`;

        // Hang until Ctrl+C is pressed
        await Bun.sleep(Number.POSITIVE_INFINITY);
    }

    info && logger.info`Database migrated`;
};

export const db = drizzle(client, { schema });
