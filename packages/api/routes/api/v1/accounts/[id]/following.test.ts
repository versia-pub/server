import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    await using client = await generateClient(users[0]);

    // Follow user
    const { ok } = await client.followAccount(users[1].id);

    expect(ok).toBe(true);
});

// /api/v1/accounts/:id/following
describe("/api/v1/accounts/:id/following", () => {
    test("should return 200 with following", async () => {
        await using client = await generateClient(users[1]);

        const { ok, data } = await client.getAccountFollowing(users[0].id);

        expect(ok).toBe(true);

        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBe(1);
        expect(data[0].id).toBe(users[1].id);
    });

    test("should return no following after unfollowing", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.unfollowAccount(users[1].id);

        expect(ok).toBe(true);

        const { ok: ok2, data } = await client.getAccountFollowing(users[1].id);

        expect(ok2).toBe(true);
        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBe(0);
    });

    test("should return no following if account is hiding collections", async () => {
        await using client0 = await generateClient(users[0]);
        await using client1 = await generateClient(users[1]);

        const { ok: ok0 } = await client1.followAccount(users[0].id);

        expect(ok0).toBe(true);

        const { ok: ok1, data: data1 } = await client0.getAccountFollowing(
            users[1].id,
        );

        expect(ok1).toBe(true);
        expect(data1).toBeArrayOfSize(1);

        const { ok: ok2 } = await client1.updateCredentials({
            hide_collections: true,
        });

        expect(ok2).toBe(true);

        const { ok: ok3, data: data3 } = await client0.getAccountFollowing(
            users[1].id,
        );

        expect(ok3).toBe(true);
        expect(data3).toBeArrayOfSize(0);
    });
});
