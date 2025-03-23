import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/accounts/:id/unpin", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.unpinAccount(users[1].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.unpinAccount(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should unpin account", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.pinAccount(users[1].id);

        expect(ok).toBe(true);
        expect(data.endorsed).toBe(true);

        const { ok: ok2, data: data2 } = await client.unpinAccount(users[1].id);

        expect(ok2).toBe(true);
        expect(data2.endorsed).toBe(false);
    });

    test("should return 200 if account already unpinned", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.unpinAccount(users[1].id);

        expect(ok).toBe(true);
        expect(data.endorsed).toBe(false);
    });
});
