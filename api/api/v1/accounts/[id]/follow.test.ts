import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/:id/follow
describe("/api/v1/accounts/:id/follow", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.followAccount(users[1].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.followAccount(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should follow user", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.followAccount(users[1].id);

        expect(ok).toBe(true);
    });

    test("should return 200 if user already followed", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.followAccount(users[1].id);

        expect(ok).toBe(true);
    });
});
