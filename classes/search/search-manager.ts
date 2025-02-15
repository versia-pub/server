/**
 * @file search-manager.ts
 * @description Sonic search integration for indexing and searching accounts and statuses
 */

import { getLogger } from "@logtape/logtape";
import { Note, User, db } from "@versia/kit/db";
import type { SQL, ValueOrArray } from "drizzle-orm";
import {
    Ingest as SonicChannelIngest,
    Search as SonicChannelSearch,
} from "sonic-channel";
import { config } from "~/config.ts";

/**
 * Enum for Sonic index types
 */
export enum SonicIndexType {
    Accounts = "accounts",
    Statuses = "statuses",
}

/**
 * Class for managing Sonic search operations
 */
export class SonicSearchManager {
    private searchChannel: SonicChannelSearch;
    private ingestChannel: SonicChannelIngest;
    private connected = false;
    private logger = getLogger("sonic");

    /**
     * @param config Configuration for Sonic
     */
    public constructor() {
        if (!config.search.sonic) {
            throw new Error("Sonic configuration is missing");
        }

        this.searchChannel = new SonicChannelSearch({
            host: config.search.sonic.host,
            port: config.search.sonic.port,
            auth: config.search.sonic.password,
        });

        this.ingestChannel = new SonicChannelIngest({
            host: config.search.sonic.host,
            port: config.search.sonic.port,
            auth: config.search.sonic.password,
        });
    }

    /**
     * Connect to Sonic
     */
    public async connect(silent = false): Promise<void> {
        if (!config.search.enabled) {
            !silent && this.logger.info`Sonic search is disabled`;
            return;
        }

        if (this.connected) {
            return;
        }

        !silent && this.logger.info`Connecting to Sonic...`;

        // Connect to Sonic
        await new Promise<boolean>((resolve, reject) => {
            this.searchChannel.connect({
                connected: (): void => {
                    !silent &&
                        this.logger.info`Connected to Sonic Search Channel`;
                    resolve(true);
                },
                disconnected: (): void =>
                    this.logger
                        .error`Disconnected from Sonic Search Channel. You might be using an incorrect password.`,
                timeout: (): void =>
                    this.logger
                        .error`Sonic Search Channel connection timed out`,
                retrying: (): void =>
                    this.logger
                        .warn`Retrying connection to Sonic Search Channel`,
                error: (error): void => {
                    this.logger
                        .error`Failed to connect to Sonic Search Channel: ${error}`;
                    reject(error);
                },
            });
        });

        await new Promise<boolean>((resolve, reject) => {
            this.ingestChannel.connect({
                connected: (): void => {
                    !silent &&
                        this.logger.info`Connected to Sonic Ingest Channel`;
                    resolve(true);
                },
                disconnected: (): void =>
                    this.logger.error`Disconnected from Sonic Ingest Channel`,
                timeout: (): void =>
                    this.logger
                        .error`Sonic Ingest Channel connection timed out`,
                retrying: (): void =>
                    this.logger
                        .warn`Retrying connection to Sonic Ingest Channel`,
                error: (error): void => {
                    this.logger
                        .error`Failed to connect to Sonic Ingest Channel: ${error}`;
                    reject(error);
                },
            });
        });

        try {
            await Promise.all([
                this.searchChannel.ping(),
                this.ingestChannel.ping(),
            ]);
            this.connected = true;
            !silent && this.logger.info`Connected to Sonic`;
        } catch (error) {
            this.logger.fatal`Error while connecting to Sonic: ${error}`;
            throw error;
        }
    }

    /**
     * Add a user to Sonic
     * @param user User to add
     */
    public async addUser(user: User): Promise<void> {
        if (!config.search.enabled) {
            return;
        }

        try {
            await this.ingestChannel.push(
                SonicIndexType.Accounts,
                "users",
                user.id,
                `${user.data.username} ${user.data.displayName} ${user.data.note}`,
            );
        } catch (error) {
            this.logger.error`Failed to add user to Sonic: ${error}`;
        }
    }

    /**
     * Get a batch of accounts from the database
     * @param n Batch number
     * @param batchSize Size of the batch
     */
    private static getNthDatabaseAccountBatch(
        n: number,
        batchSize = 1000,
    ): Promise<Record<string, string | Date>[]> {
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
            orderBy: (user, { asc }): ValueOrArray<SQL> => asc(user.createdAt),
        });
    }

    /**
     * Get a batch of statuses from the database
     * @param n Batch number
     * @param batchSize Size of the batch
     */
    private static getNthDatabaseStatusBatch(
        n: number,
        batchSize = 1000,
    ): Promise<Record<string, string | Date>[]> {
        return db.query.Notes.findMany({
            offset: n * batchSize,
            limit: batchSize,
            columns: {
                id: true,
                content: true,
                createdAt: true,
            },
            orderBy: (status, { asc }): ValueOrArray<SQL> =>
                asc(status.createdAt),
        });
    }

    /**
     * Rebuild search indexes
     * @param indexes Indexes to rebuild
     * @param batchSize Size of each batch
     * @param progressCallback Callback for progress updates
     */
    public async rebuildSearchIndexes(
        indexes: SonicIndexType[],
        batchSize = 100,
        progressCallback?: (progress: number) => void,
    ): Promise<void> {
        for (const index of indexes) {
            if (index === SonicIndexType.Accounts) {
                await this.rebuildAccountsIndex(batchSize, progressCallback);
            } else if (index === SonicIndexType.Statuses) {
                await this.rebuildStatusesIndex(batchSize, progressCallback);
            }
        }
    }

    /**
     * Rebuild accounts index
     * @param batchSize Size of each batch
     * @param progressCallback Callback for progress updates
     */
    private async rebuildAccountsIndex(
        batchSize: number,
        progressCallback?: (progress: number) => void,
    ): Promise<void> {
        const accountCount = await User.getCount();
        const batchCount = Math.ceil(accountCount / batchSize);

        for (let i = 0; i < batchCount; i++) {
            const accounts =
                await SonicSearchManager.getNthDatabaseAccountBatch(
                    i,
                    batchSize,
                );
            await Promise.all(
                accounts.map((account) =>
                    this.ingestChannel.push(
                        SonicIndexType.Accounts,
                        "users",
                        account.id as string,
                        `${account.username} ${account.displayName} ${account.note}`,
                    ),
                ),
            );
            progressCallback?.((i + 1) / batchCount);
        }
    }

    /**
     * Rebuild statuses index
     * @param batchSize Size of each batch
     * @param progressCallback Callback for progress updates
     */
    private async rebuildStatusesIndex(
        batchSize: number,
        progressCallback?: (progress: number) => void,
    ): Promise<void> {
        const statusCount = await Note.getCount();
        const batchCount = Math.ceil(statusCount / batchSize);

        for (let i = 0; i < batchCount; i++) {
            const statuses = await SonicSearchManager.getNthDatabaseStatusBatch(
                i,
                batchSize,
            );
            await Promise.all(
                statuses.map((status) =>
                    this.ingestChannel.push(
                        SonicIndexType.Statuses,
                        "notes",
                        status.id as string,
                        status.content as string,
                    ),
                ),
            );
            progressCallback?.((i + 1) / batchCount);
        }
    }

    /**
     * Search for accounts
     * @param query Search query
     * @param limit Maximum number of results
     * @param offset Offset for pagination
     */
    public searchAccounts(
        query: string,
        limit = 10,
        offset = 0,
    ): Promise<string[]> {
        return this.searchChannel.query(
            SonicIndexType.Accounts,
            "users",
            query,
            { limit, offset },
        );
    }

    /**
     * Search for statuses
     * @param query Search query
     * @param limit Maximum number of results
     * @param offset Offset for pagination
     */
    public searchStatuses(
        query: string,
        limit = 10,
        offset = 0,
    ): Promise<string[]> {
        return this.searchChannel.query(
            SonicIndexType.Statuses,
            "notes",
            query,
            { limit, offset },
        );
    }
}

export const searchManager = new SonicSearchManager();
