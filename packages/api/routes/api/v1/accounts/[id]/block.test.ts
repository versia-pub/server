import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/:id/block
describe("/api/v1/accounts/:id/block", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.blockAccount(users[1].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.blockAccount(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should block user", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.blockAccount(users[1].id);

        expect(ok).toBe(true);
        expect(data.blocking).toBe(true);
    });

    test("should return 200 if user already blocked", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.blockAccount(users[1].id);

        expect(ok).toBe(true);
        expect(data.blocking).toBe(true);
    });
});
