import { generateChallenge } from "@/challenges";
import { randomString } from "@/math";
import { solveChallenge } from "altcha-lib";
import { asc, inArray, like } from "drizzle-orm";
import { appFactory } from "~/app";
import { Note } from "~/classes/database/note";
import { User } from "~/classes/database/user";
import type { Status } from "~/classes/functions/status";
import { searchManager } from "~/classes/search/search-manager";
import { db } from "~/drizzle/db";
import { setupDatabase } from "~/drizzle/db";
import { Notes, Tokens, Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";

await setupDatabase();
if (config.sonic.enabled) {
    await searchManager.connect();
}

const app = await appFactory();

export function fakeRequest(url: URL | string, init?: RequestInit) {
    return Promise.resolve(
        app.fetch(new Request(new URL(url, config.http.base_url), init)),
    );
}

export const deleteOldTestUsers = async () => {
    // Deletes all users that match the test username (test-<32 random characters>)
    await db.delete(Users).where(like(Users.username, "test-%"));
};

export const getTestUsers = async (count: number) => {
    const users: User[] = [];
    const passwords: string[] = [];

    for (let i = 0; i < count; i++) {
        const password = randomString(32, "hex");

        const user = await User.fromDataLocal({
            username: `test-${randomString(32, "hex")}`,
            email: `${randomString(32, "hex")}@test.com`,
            password,
        });

        if (!user) {
            throw new Error("Failed to create test user");
        }

        passwords.push(password);
        users.push(user);
    }

    const tokens = await db
        .insert(Tokens)
        .values(
            users.map((u) => ({
                accessToken: randomString(32, "hex"),
                tokenType: "bearer",
                userId: u.id,
                applicationId: null,
                code: randomString(32, "hex"),
                scope: "read write follow push",
            })),
        )
        .returning();

    return {
        users,
        tokens,
        passwords,
        deleteUsers: async () => {
            await db.delete(Users).where(
                inArray(
                    Users.id,
                    users.map((u) => u.id),
                ),
            );
        },
    };
};

export const getTestStatuses = async (
    count: number,
    user: User,
    partial?: Partial<Status>,
) => {
    const statuses: Note[] = [];

    for (let i = 0; i < count; i++) {
        const newStatus = await Note.insert({
            content: `${i} ${randomString(32, "hex")}`,
            authorId: user.id,
            sensitive: false,
            updatedAt: new Date().toISOString(),
            visibility: "public",
            applicationId: null,
            ...partial,
        });

        if (!newStatus) {
            throw new Error("Failed to create test status");
        }

        statuses.push(newStatus);
    }

    return (
        await Note.manyFromSql(
            inArray(
                Notes.id,
                statuses.map((s) => s.id),
            ),
            asc(Notes.id),
            undefined,
            undefined,
            user.id,
        )
    ).map((n) => n.data);
};

/**
 * Generates a solved challenge (with tiny difficulty)
 *
 * Only to be used in tests
 * @returns Base64 encoded payload
 */
export const getSolvedChallenge = async () => {
    const { challenge } = await generateChallenge(100);

    const solution = await solveChallenge(
        challenge.challenge,
        challenge.salt,
        challenge.algorithm,
        challenge.maxnumber,
    ).promise;

    if (!solution) {
        throw new Error("Failed to solve challenge");
    }

    return Buffer.from(
        JSON.stringify({
            number: solution.number,
            algorithm: challenge.algorithm,
            challenge: challenge.challenge,
            salt: challenge.salt,
            signature: challenge.signature,
        }),
    ).toString("base64");
};
