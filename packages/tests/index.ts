import { mock } from "bun:test";
import { Client as VersiaClient } from "@versia/client";
import { db, Note, setupDatabase, Token, User } from "@versia/kit/db";
import { Notes, Users } from "@versia/kit/tables";
import { config } from "@versia-server/config";
import { solveChallenge } from "altcha-lib";
import { env, randomUUIDv7 } from "bun";
import { asc, type InferSelectModel, inArray, like } from "drizzle-orm";
import { generateChallenge } from "@/challenges";
import { randomString } from "@/math";
import { searchManager } from "~/classes/search/search-manager";
import { appFactory } from "~/packages/api/app";

env.DISABLE_RATE_LIMIT = "true";
await setupDatabase();

if (config.search.enabled) {
    await searchManager.connect();
}

const app = await appFactory();

export function fakeRequest(
    url: URL | string,
    init?: RequestInit,
): Promise<Response> {
    return Promise.resolve(
        app.fetch(new Request(new URL(url, config.http.base_url), init)),
    );
}

/**
 * Generate a client instance monkeypatched to use the test server
 * instead of going through HTTP, and also doesn't throw on errors
 * @param user User to automatically generate a token for
 * @returns Client instance
 */
export const generateClient = async (
    user?: User,
): Promise<
    VersiaClient & {
        [Symbol.asyncDispose](): Promise<void>;
        dbToken: Token;
    }
> => {
    const token = user
        ? await Token.insert({
              id: randomUUIDv7(),
              accessToken: randomString(32, "hex"),
              tokenType: "bearer",
              userId: user.id,
              applicationId: null,
              code: randomString(32, "hex"),
              scope: "read write follow push",
          })
        : null;

    const client = new VersiaClient(
        new URL(config.http.base_url),
        token?.data.accessToken,
    );

    // biome-ignore lint/complexity/useLiteralKeys: Overriding private properties
    client["fetch"] = (
        input: RequestInfo | string | URL | Request,
        init?: RequestInit,
    ): Promise<Response> => {
        return Promise.resolve(app.fetch(new Request(input, init)));
    };

    // @ts-expect-error This is REAL monkeypatching done by REAL programmers, BITCH!
    client[Symbol.asyncDispose] = async (): Promise<void> => {
        await token?.delete();
    };

    // @ts-expect-error More monkeypatching
    client.dbToken = token;

    return client as VersiaClient & {
        [Symbol.asyncDispose](): Promise<void>;
        dbToken: Token;
    };
};
export const deleteOldTestUsers = async (): Promise<void> => {
    // Deletes all users that match the test username (test-<32 random characters>)
    await db.delete(Users).where(like(Users.username, "test-%"));
};

export const getTestUsers = async (
    count: number,
): Promise<{
    users: User[];
    tokens: Token[];
    passwords: string[];
    deleteUsers: () => Promise<void>;
}> => {
    const users: User[] = [];
    const passwords: string[] = [];

    for (let i = 0; i < count; i++) {
        const password = randomString(32, "hex");

        const user = await User.register(`test-${randomString(8, "hex")}`, {
            email: `${randomString(16, "hex")}@test.com`,
            password,
        });

        if (!user) {
            throw new Error("Failed to create test user");
        }

        passwords.push(password);
        users.push(user);
    }

    const tokens = await Token.insertMany(
        users.map((u) => ({
            id: randomUUIDv7(),
            accessToken: randomString(32, "hex"),
            tokenType: "bearer",
            userId: u.id,
            applicationId: null,
            code: randomString(32, "hex"),
            scope: "read write follow push",
        })),
    );

    return {
        users,
        // Order tokens in the same order as users
        // The first token belongs to the first user, the second token belongs to the second user, etc.
        tokens: users.map(
            (u) => tokens.find((t) => t.data.userId === u.id) as Token,
        ),
        passwords,
        deleteUsers: async (): Promise<void> => {
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
    partial?: Partial<InferSelectModel<typeof Notes>>,
): Promise<Note["data"][]> => {
    const statuses: Note[] = [];

    for (let i = 0; i < count; i++) {
        const newStatus = await Note.insert({
            id: randomUUIDv7(),
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
export const getSolvedChallenge = async (): Promise<string> => {
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

/**
 * Mocks a module for the duration of a test
 * Workaround for https://github.com/oven-sh/bun/issues/7823
 *
 * @param modulePath - The path starting from this files' path.
 * @param renderMocks - Function to generate mocks (by their named or default exports)
 * @returns An object with a dispose method
 */
export const mockModule = async (
    modulePath: string,
    renderMocks: () => Record<string, unknown>,
): Promise<{
    [Symbol.dispose](): void;
}> => {
    const original = {
        ...(await import(modulePath)),
    };
    const mocks = renderMocks();
    const result = {
        ...original,
        ...mocks,
    };
    mock.module(modulePath, () => result);
    return {
        [Symbol.dispose]: (): void => {
            mock.module(modulePath, () => original);
        },
    };
};
