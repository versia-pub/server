import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/lookup
describe("/api/v1/accounts/lookup", () => {
    test("should return 200 with users", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.lookupAccount(users[0].data.username);

        expect(ok).toBe(true);
        expect(data).toEqual(
            expect.objectContaining({
                id: users[0].id,
                username: users[0].data.username,
                display_name: users[0].data.displayName,
                avatar: expect.any(String),
                header: expect.any(String),
            }),
        );
    });

    test("should require exact case", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.lookupAccount(
            users[0].data.username.toUpperCase(),
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });
});
