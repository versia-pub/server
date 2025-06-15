import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(3);

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/accounts/:id/unfollow", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.unfollowAccount(users[1].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.unfollowAccount(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should unfollow user", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.followAccount(users[1].id);

        expect(ok).toBe(true);

        const { ok: ok2 } = await client.unfollowAccount(users[1].id);

        expect(ok2).toBe(true);

        const { ok: ok3, data } = await client.getAccount(users[1].id);

        expect(ok3).toBe(true);
        expect(data.followers_count).toBe(0);

        const { ok: ok4, data: data4 } = await client.getAccount(users[0].id);

        expect(ok4).toBe(true);
        expect(data4.following_count).toBe(0);
    });

    test("should return 200 if user already followed", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.followAccount(users[1].id);

        expect(ok).toBe(true);
    });
});
