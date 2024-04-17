import chalk from "chalk";
import { config } from "config-manager";
import { count } from "drizzle-orm";
import { LogLevel, type LogManager, type MultiLogManager } from "log-manager";
import { Meilisearch } from "meilisearch";
import type { Status } from "~database/entities/Status";
import type { User } from "~database/entities/User";
import { db } from "~drizzle/db";
import { Notes, Users } from "~drizzle/schema";

export const meilisearch = new Meilisearch({
    host: `${config.meilisearch.host}:${config.meilisearch.port}`,
    apiKey: config.meilisearch.api_key,
});

export const connectMeili = async (logger: MultiLogManager | LogManager) => {
    if (!config.meilisearch.enabled) return;

    if (await meilisearch.isHealthy()) {
        await meilisearch
            .index(MeiliIndexType.Accounts)
            .updateSortableAttributes(["createdAt"]);

        await meilisearch
            .index(MeiliIndexType.Accounts)
            .updateSearchableAttributes(["username", "displayName", "note"]);

        await meilisearch
            .index(MeiliIndexType.Statuses)
            .updateSortableAttributes(["createdAt"]);

        await meilisearch
            .index(MeiliIndexType.Statuses)
            .updateSearchableAttributes(["content"]);

        await logger.log(
            LogLevel.INFO,
            "Meilisearch",
            "Connected to Meilisearch",
        );
    } else {
        await logger.log(
            LogLevel.CRITICAL,
            "Meilisearch",
            "Error while connecting to Meilisearch",
        );
        process.exit(1);
    }
};

export enum MeiliIndexType {
    Accounts = "accounts",
    Statuses = "statuses",
}

export const addStausToMeilisearch = async (status: Status) => {
    if (!config.meilisearch.enabled) return;

    await meilisearch.index(MeiliIndexType.Statuses).addDocuments([
        {
            id: status.id,
            content: status.content,
            createdAt: status.createdAt,
        },
    ]);
};

export const addUserToMeilisearch = async (user: User) => {
    if (!config.meilisearch.enabled) return;

    await meilisearch.index(MeiliIndexType.Accounts).addDocuments([
        {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            note: user.note,
            createdAt: user.createdAt,
        },
    ]);
};

export const getNthDatabaseAccountBatch = (
    n: number,
    batchSize = 1000,
): Promise<Record<string, string | Date>[]> => {
    return db.query.Users.findMany({
        offset: n * batchSize,
        limit: batchSize,
        columns: {
            id: true,
            username: true,
            displayName: true,
            note: true,
            createdAt: true,
        },
        orderBy: (user, { asc }) => asc(user.createdAt),
    });
};

export const getNthDatabaseStatusBatch = (
    n: number,
    batchSize = 1000,
): Promise<Record<string, string | Date>[]> => {
    return db.query.Notes.findMany({
        offset: n * batchSize,
        limit: batchSize,
        columns: {
            id: true,
            content: true,
            createdAt: true,
        },
        orderBy: (status, { asc }) => asc(status.createdAt),
    });
};

export const rebuildSearchIndexes = async (
    indexes: MeiliIndexType[],
    batchSize = 100,
) => {
    if (indexes.includes(MeiliIndexType.Accounts)) {
        const accountCount = (
            await db
                .select({
                    count: count(),
                })
                .from(Users)
        )[0].count;

        for (let i = 0; i < accountCount / batchSize; i++) {
            const accounts = await getNthDatabaseAccountBatch(i, batchSize);

            const progress = Math.round((i / (accountCount / batchSize)) * 100);

            console.log(`${chalk.green("✓")} ${progress}%`);

            // Sync with Meilisearch
            await meilisearch
                .index(MeiliIndexType.Accounts)
                .addDocuments(accounts);
        }

        const meiliAccountCount = (
            await meilisearch.index(MeiliIndexType.Accounts).getStats()
        ).numberOfDocuments;

        console.log(
            `${chalk.green("✓")} ${chalk.bold(
                `Done! ${meiliAccountCount} accounts indexed`,
            )}`,
        );
    }

    if (indexes.includes(MeiliIndexType.Statuses)) {
        const statusCount = (
            await db
                .select({
                    count: count(),
                })
                .from(Notes)
        )[0].count;

        for (let i = 0; i < statusCount / batchSize; i++) {
            const statuses = await getNthDatabaseStatusBatch(i, batchSize);

            const progress = Math.round((i / (statusCount / batchSize)) * 100);

            console.log(`${chalk.green("✓")} ${progress}%`);

            // Sync with Meilisearch
            await meilisearch
                .index(MeiliIndexType.Statuses)
                .addDocuments(statuses);
        }

        const meiliStatusCount = (
            await meilisearch.index(MeiliIndexType.Statuses).getStats()
        ).numberOfDocuments;

        console.log(
            `${chalk.green("✓")} ${chalk.bold(
                `Done! ${meiliStatusCount} statuses indexed`,
            )}`,
        );
    }
};
