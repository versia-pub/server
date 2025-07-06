import { db } from "@versia/kit/db";
import {
    Notes,
    PollOptions,
    Polls,
    PollVotes,
    type Users,
} from "@versia/kit/tables";
import {
    and,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
} from "drizzle-orm";
import { randomUUIDv7 } from "bun";
import type { z } from "zod";
import type { Poll as PollSchema } from "@versia/client/schemas";
import { BaseInterface } from "./base.ts";

/**
 * Type definition for Poll with all relations
 */
type PollTypeWithRelations = InferSelectModel<typeof Polls> & {
    options: (InferSelectModel<typeof PollOptions> & {
        votes: InferSelectModel<typeof PollVotes>[];
    })[];
    votes: InferSelectModel<typeof PollVotes>[];
};

/**
 * Database class for managing polls
 */
export class Poll extends BaseInterface<typeof Polls, PollTypeWithRelations> {
    public static $type: PollTypeWithRelations;

    /**
     * Reload the poll data from the database
     */
    public async reload(): Promise<void> {
        const reloaded = await Poll.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload poll");
        }

        this.data = reloaded.data;
    }

    /**
     * Get a poll by ID
     * @param id - The poll ID
     * @returns The poll instance or null if not found
     */
    public static async fromId(id: string | null): Promise<Poll | null> {
        if (!id) {
            return null;
        }

        return await Poll.fromSql(eq(Polls.id, id));
    }

    /**
     * Get a poll by note ID
     * @param noteId - The note ID
     * @returns The poll instance or null if not found
     */
    public static async fromNoteId(noteId: string): Promise<Poll | null> {
        return await Poll.fromSql(eq(Polls.noteId, noteId));
    }

    /**
     * Get multiple polls by IDs
     * @param ids - Array of poll IDs
     * @returns Array of poll instances
     */
    public static async fromIds(ids: string[]): Promise<Poll[]> {
        return await Poll.manyFromSql(inArray(Polls.id, ids));
    }

    /**
     * Execute SQL query to get a single poll with relations
     * @param sql - SQL condition
     * @returns Poll instance or null
     */
    protected static async fromSql(sql: any): Promise<Poll | null> {
        const result = await db
            .select()
            .from(Polls)
            .leftJoin(PollOptions, eq(Polls.id, PollOptions.pollId))
            .leftJoin(PollVotes, eq(PollOptions.id, PollVotes.optionId))
            .where(sql);

        if (result.length === 0) {
            return null;
        }

        // Group the results to build the poll object with options
        const pollData = result[0].Polls;
        const optionsMap = new Map<string, any>();
        const votesData: InferSelectModel<typeof PollVotes>[] = [];

        for (const row of result) {
            if (row.PollOptions) {
                if (!optionsMap.has(row.PollOptions.id)) {
                    optionsMap.set(row.PollOptions.id, {
                        ...row.PollOptions,
                        votes: [],
                    });
                }

                if (row.PollVotes) {
                    optionsMap.get(row.PollOptions.id)!.votes.push(row.PollVotes);
                    votesData.push(row.PollVotes);
                }
            }
        }

        const options = Array.from(optionsMap.values()).sort((a, b) => a.index - b.index);

        const pollWithRelations: PollTypeWithRelations = {
            ...pollData,
            options,
            votes: votesData,
        };

        return new Poll(pollWithRelations);
    }

    /**
     * Execute SQL query to get multiple polls with relations
     * @param sql - SQL condition
     * @returns Array of poll instances
     */
    protected static async manyFromSql(sql: any): Promise<Poll[]> {
        const result = await db
            .select()
            .from(Polls)
            .leftJoin(PollOptions, eq(Polls.id, PollOptions.pollId))
            .leftJoin(PollVotes, eq(PollOptions.id, PollVotes.optionId))
            .where(sql);

        if (result.length === 0) {
            return [];
        }

        // Group by poll ID
        const pollsMap = new Map<string, any>();

        for (const row of result) {
            const pollId = row.Polls.id;

            if (!pollsMap.has(pollId)) {
                pollsMap.set(pollId, {
                    ...row.Polls,
                    options: new Map(),
                    votes: [],
                });
            }

            const poll = pollsMap.get(pollId);

            if (row.PollOptions) {
                if (!poll.options.has(row.PollOptions.id)) {
                    poll.options.set(row.PollOptions.id, {
                        ...row.PollOptions,
                        votes: [],
                    });
                }

                if (row.PollVotes) {
                    poll.options.get(row.PollOptions.id)!.votes.push(row.PollVotes);
                    poll.votes.push(row.PollVotes);
                }
            }
        }

        return Array.from(pollsMap.values()).map((pollData) => {
            const options = Array.from(pollData.options.values()).sort(
                (a, b) => a.index - b.index,
            );

            return new Poll({
                ...pollData,
                options,
                votes: pollData.votes,
            });
        });
    }

    /**
     * Insert a new poll into the database
     * @param pollData - Poll data to insert
     * @param options - Poll options to insert
     * @returns The inserted poll instance
     */
    public static async insert(
        pollData: InferInsertModel<typeof Polls>,
        options: string[],
    ): Promise<Poll> {
        return await db.transaction(async (tx) => {
            // Insert the poll
            const insertedPoll = (await tx.insert(Polls).values(pollData).returning())[0];

            // Insert poll options
            const optionInserts = options.map((title, index) => ({
                id: randomUUIDv7(),
                pollId: insertedPoll.id,
                title,
                index,
                votesCount: 0,
            }));

            await tx.insert(PollOptions).values(optionInserts);

            // Return the poll with relations
            const poll = await Poll.fromId(insertedPoll.id);
            if (!poll) {
                throw new Error("Failed to retrieve inserted poll");
            }

            return poll;
        });
    }

    /**
     * Check if the poll has expired
     * @returns True if the poll has expired
     */
    public isExpired(): boolean {
        if (!this.data.expiresAt) {
            return false;
        }

        return new Date(this.data.expiresAt) < new Date();
    }

    /**
     * Check if a user has voted in this poll
     * @param userId - The user ID to check
     * @returns True if the user has voted
     */
    public hasUserVoted(userId: string): boolean {
        return this.data.votes.some((vote) => vote.userId === userId);
    }

    /**
     * Get the vote options for a specific user
     * @param userId - The user ID
     * @returns Array of option indices the user voted for
     */
    public getUserVotes(userId: string): number[] {
        const userVotes = this.data.votes.filter((vote) => vote.userId === userId);
        return userVotes.map((vote) => {
            const option = this.data.options.find((opt) => opt.id === vote.optionId);
            return option?.index ?? -1;
        }).filter((index) => index !== -1);
    }

    /**
     * Convert poll to Mastodon API format
     * @param userFetching - The user fetching the poll (to check if they voted)
     * @returns Poll in Mastodon API format
     */
    public toApi(userFetching?: { id: string } | null): z.infer<typeof PollSchema> {
        const voted = userFetching ? this.hasUserVoted(userFetching.id) : undefined;
        const ownVotes = userFetching ? this.getUserVotes(userFetching.id) : undefined;

        return {
            id: this.data.id,
            expires_at: this.data.expiresAt,
            expired: this.isExpired(),
            multiple: this.data.multiple,
            votes_count: this.data.votesCount,
            voters_count: this.data.votersCount,
            options: this.data.options.map((option) => ({
                title: option.title,
                votes_count: this.data.hideTotals && !this.isExpired() ? null : option.votesCount,
            })),
            emojis: [], // TODO: Parse emojis from poll options
            voted,
            own_votes: ownVotes,
        };
    }
}