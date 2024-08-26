import { getLogger } from "@logtape/logtape";
import chalk from "chalk";
import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { withReplicas } from "drizzle-orm/pg-core";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Pool } from "pg";
import { config } from "~/packages/config-manager";
import * as schema from "./schema";

const primaryDb = new Pool({
    host: config.database.host,
    port: Number(config.database.port),
    user: config.database.username,
    password: config.database.password,
    database: config.database.database,
});

const replicas =
    config.database.replicas?.map(
        (replica) =>
            new Pool({
                host: replica.host,
                port: Number(replica.port),
                user: replica.username,
                password: replica.password,
                database: replica.database,
            }),
    ) ?? [];

export const db =
    (replicas.length ?? 0) > 0
        ? withReplicas(
              drizzle(primaryDb, { schema }),
              replicas.map((r) => drizzle(r, { schema })) as [
                  NodePgDatabase<typeof schema>,
                  ...NodePgDatabase<typeof schema>[],
              ],
          )
        : drizzle(primaryDb, { schema });

export const setupDatabase = async (info = true) => {
    const logger = getLogger("database");

    for (const dbPool of [primaryDb, ...replicas]) {
        try {
            await dbPool.connect();
        } catch (e) {
            if (
                (e as Error).message ===
                "Client has already been connected. You cannot reuse a client."
            ) {
                return;
            }

            logger.fatal`${e}`;
            logger.fatal`Failed to connect to database ${chalk.bold(
                // Index of the database in the array
                replicas.indexOf(dbPool) === -1
                    ? "primary"
                    : `replica-${replicas.indexOf(dbPool)}`,
            )}. Please check your configuration.`;

            // Hang until Ctrl+C is pressed
            await Bun.sleep(Number.POSITIVE_INFINITY);
        }
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
