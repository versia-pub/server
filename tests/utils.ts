import { randomBytes } from "node:crypto";
import { asc, inArray, like } from "drizzle-orm";
import type { Status } from "~database/entities/Status";
import {
    type User,
    type UserWithRelations,
    createNewLocalUser,
} from "~database/entities/User";
import { db } from "~drizzle/db";
import { Notes, Tokens, Users } from "~drizzle/schema";
import { server } from "~index";
import { Note } from "~packages/database-interface/note";
/**
 * This allows us to send a test request to the server even when it isnt running
 * CURRENTLY NOT WORKING, NEEDS TO BE FIXED
 * @param req Request to send
 * @returns Response from the server
 */
export async function sendTestRequest(req: Request) {
    return server.fetch(req);
}

export function wrapRelativeUrl(url: string, base_url: string) {
    return new URL(url, base_url);
}

export const deleteOldTestUsers = async () => {
    // Deletes all users that match the test username (test-<32 random characters>)
    await db.delete(Users).where(like(Users.username, "test-%"));
};

export const getTestUsers = async (count: number) => {
    const users: UserWithRelations[] = [];
    const passwords: string[] = [];

    for (let i = 0; i < count; i++) {
        const password = randomBytes(32).toString("hex");

        const user = await createNewLocalUser({
            username: `test-${randomBytes(32).toString("hex")}`,
            email: `${randomBytes(32).toString("hex")}@test.com`,
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
                accessToken: randomBytes(32).toString("hex"),
                tokenType: "bearer",
                userId: u.id,
                applicationId: null,
                code: randomBytes(32).toString("hex"),
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
    const statuses: Status[] = [];

    for (let i = 0; i < count; i++) {
        const newStatus = await Note.insert({
            content: `${i} ${randomBytes(32).toString("hex")}`,
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
        )
    ).map((n) => n.getStatus());
};
