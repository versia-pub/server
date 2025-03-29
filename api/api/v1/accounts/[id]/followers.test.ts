import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    await using client = await generateClient(users[0]);

    // Follow user
    const { ok, raw } = await client.followAccount(users[1].id);

    expect(ok).toBe(true);
    expect(raw.status).toBe(200);
});

// /api/v1/accounts/:id/followers
describe("/api/v1/accounts/:id/followers", () => {
    test("should return 200 with followers", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getAccountFollowers(users[1].id);

        expect(ok).toBe(true);

        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBe(1);
        expect(data[0].id).toBe(users[0].id);
    });

    test("should return no followers after unfollowing", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.unfollowAccount(users[1].id);

        expect(ok).toBe(true);

        const { ok: ok2, data } = await client.getAccountFollowers(users[1].id);

        expect(ok2).toBe(true);
        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBe(0);
    });
});
