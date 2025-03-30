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

    test("should return no followers if account is hiding collections", async () => {
        await using client0 = await generateClient(users[0]);
        await using client1 = await generateClient(users[1]);

        const { ok: ok0 } = await client0.followAccount(users[1].id);

        expect(ok0).toBe(true);

        const { ok: ok1, data: data1 } = await client0.getAccountFollowers(
            users[1].id,
        );

        expect(ok1).toBe(true);
        expect(data1).toBeArrayOfSize(1);

        const { ok: ok2 } = await client1.updateCredentials({
            hide_collections: true,
        });

        expect(ok2).toBe(true);

        const { ok: ok3, data: data3 } = await client0.getAccountFollowers(
            users[1].id,
        );

        expect(ok3).toBe(true);
        expect(data3).toBeArrayOfSize(0);
    });
});
