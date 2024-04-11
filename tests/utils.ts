import {
    createNewLocalUser,
    type User,
    type UserWithRelations,
} from "~database/entities/User";
import { randomBytes } from "node:crypto";
import { server } from "~index";
import { db } from "~drizzle/db";
import { status, token, user } from "~drizzle/schema";
import { inArray, like } from "drizzle-orm";
import type { Status } from "~database/entities/Status";

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
    await db.delete(user).where(like(user.username, "test-%"));
};

export const getTestUsers = async (count: number) => {
    const users: UserWithRelations[] = [];

    for (let i = 0; i < count; i++) {
        const user = await createNewLocalUser({
            username: `test-${randomBytes(32).toString("hex")}`,
            email: `${randomBytes(32).toString("hex")}@test.com`,
            password: randomBytes(32).toString("hex"),
            skipPasswordHash: true,
        });

        if (!user) {
            throw new Error("Failed to create test user");
        }

        users.push(user);
    }

    const tokens = await db
        .insert(token)
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
        deleteUsers: async () => {
            await db.delete(user).where(
                inArray(
                    user.id,
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
        const newStatus = (
            await db
                .insert(status)
                .values({
                    content: `${i} ${randomBytes(32).toString("hex")}`,
                    authorId: user.id,
                    sensitive: false,
                    updatedAt: new Date().toISOString(),
                    visibility: "public",
                    ...partial,
                })
                .returning()
        )[0];

        if (!newStatus) {
            throw new Error("Failed to create test status");
        }

        statuses.push(newStatus);
    }

    return statuses.toSorted((a, b) => a.id.localeCompare(b.id));
};
