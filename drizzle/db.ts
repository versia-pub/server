import { getLogger } from "@logtape/logtape";
import chalk from "chalk";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { withReplicas } from "drizzle-orm/pg-core";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Pool } from "pg";
import { config } from "~/config.ts";
import * as schema from "./schema.ts";

const primaryDb = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.username,
    password: config.postgres.password,
    database: config.postgres.database,
});

const replicas = config.postgres.replicas.map(
    (replica) =>
        new Pool({
            host: replica.host,
            port: replica.port,
            user: replica.username,
            password: replica.password,
            database: replica.database,
        }),
);

export const db =
    (replicas.length ?? 0) > 0
        ? withReplicas(
              drizzle(primaryDb, { schema }),
              replicas.map((r) => drizzle(r, { schema })) as [
                  // biome-ignore lint/style/useNamingConvention: <explanation>
                  NodePgDatabase<typeof schema> & { $client: Pool },
                  // biome-ignore lint/style/useNamingConvention: <explanation>
                  ...(NodePgDatabase<typeof schema> & { $client: Pool })[],
              ],
          )
        : drizzle(primaryDb, { schema });

export const setupDatabase = async (info = true): Promise<void> => {
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

            logger.fatal`Failed to connect to database ${chalk.bold(
                // Index of the database in the array
                replicas.indexOf(dbPool) === -1
                    ? "primary"
                    : `replica-${replicas.indexOf(dbPool)}`,
            )}. Please check your configuration.`;

            throw e;
        }
    }

    // Migrate the database
    info && logger.info`Migrating database...`;

    try {
        await migrate(db, {
            migrationsFolder: "./drizzle/migrations",
        });
    } catch (e) {
        logger.fatal`Failed to migrate database. Please check your configuration.`;

        throw e;
    }

    info && logger.info`Database migrated`;
};
