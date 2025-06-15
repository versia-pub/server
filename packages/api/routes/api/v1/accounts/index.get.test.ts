import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/accounts", () => {
    test("should return accounts", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getAccounts(users.map((u) => u.id));

        expect(ok).toBe(true);
        expect(data).toEqual(
            expect.arrayContaining(
                users.map((u) =>
                    expect.objectContaining({
                        id: u.id,
                        username: u.data.username,
                        acct: u.data.username,
                    }),
                ),
            ),
        );
    });

    test("should skip nonexistent accounts", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getAccounts([
            ...users.map((u) => u.id),
            "00000000-0000-0000-0000-000000000000",
        ]);

        expect(ok).toBe(true);
        expect(data).toEqual(
            expect.arrayContaining(
                users.map((u) =>
                    expect.objectContaining({
                        id: u.id,
                        username: u.data.username,
                        acct: u.data.username,
                    }),
                ),
            ),
        );
        expect(data).toHaveLength(users.length);
    });
});
