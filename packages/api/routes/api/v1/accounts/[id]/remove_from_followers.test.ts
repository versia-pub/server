import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    // Make users[1] follow users[0]
    await using client = await generateClient(users[1]);

    const { ok } = await client.followAccount(users[0].id);

    expect(ok).toBe(true);
});

describe("/api/v1/accounts/:id/remove_from_followers", () => {
    test("should return 401 when not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.removeFromFollowers(users[1].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 when target account doesn't exist", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.removeFromFollowers("non-existent-id");

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should remove follower and return relationship", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.removeFromFollowers(users[1].id);

        expect(ok).toBe(true);
        expect(data.id).toBe(users[1].id);
        expect(data.following).toBe(false);
        expect(data.followed_by).toBe(false);
    });

    test("should handle case when user is not following", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.removeFromFollowers(users[1].id);

        expect(ok).toBe(true);
        expect(data.id).toBe(users[1].id);
        expect(data.following).toBe(false);
        expect(data.followed_by).toBe(false);
    });
});
