import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(5);

beforeAll(async () => {
    // Create followers relationships
    await using client = await generateClient(users[0]);

    const { ok } = await client.followAccount(users[1].id);

    expect(ok).toBe(true);

    const { ok: ok2 } = await client.followAccount(users[2].id);

    expect(ok2).toBe(true);

    const { ok: ok3 } = await client.followAccount(users[3].id);

    expect(ok3).toBe(true);

    await using client1 = await generateClient(users[1]);

    const { ok: ok4 } = await client1.followAccount(users[2].id);

    expect(ok4).toBe(true);

    const { ok: ok5 } = await client1.followAccount(users[3].id);

    expect(ok5).toBe(true);

    await using client2 = await generateClient(users[2]);

    const { ok: ok6 } = await client2.followAccount(users[3].id);

    expect(ok6).toBe(true);
});

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/accounts/familiar_followers", () => {
    test("should return 0 familiar followers", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getFamiliarFollowers([users[4].id]);

        expect(ok).toBe(true);
        expect(data[0].accounts).toBeArrayOfSize(0);
    });

    test("should return 1 familiar follower", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getFamiliarFollowers([users[2].id]);

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(1);
        expect(data[0].id).toBe(users[2].id);
        expect(data[0].accounts).toBeArrayOfSize(1);
        expect(data[0].accounts[0].id).toBe(users[1].id);
    });

    test("should return 2 familiar followers", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getFamiliarFollowers([users[3].id]);

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(1);
        expect(data[0].id).toBe(users[3].id);
        expect(data[0].accounts).toBeArrayOfSize(2);
        expect(data[0].accounts[0].id).toBe(users[2].id);
        expect(data[0].accounts[1].id).toBe(users[1].id);
    });

    test("should work with multiple ids", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getFamiliarFollowers([
            users[2].id,
            users[3].id,
            users[4].id,
        ]);

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(3);
        expect(data[0].id).toBe(users[2].id);
        expect(data[0].accounts).toBeArrayOfSize(1);
        expect(data[0].accounts[0].id).toBe(users[1].id);
        expect(data[1].id).toBe(users[3].id);
        expect(data[1].accounts).toBeArrayOfSize(2);
        expect(data[1].accounts[0].id).toBe(users[2].id);
        expect(data[1].accounts[1].id).toBe(users[1].id);
        expect(data[2].id).toBe(users[4].id);
        expect(data[2].accounts).toBeArrayOfSize(0);
    });
});
