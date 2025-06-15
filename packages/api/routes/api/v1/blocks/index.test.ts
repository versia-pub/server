import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(3);

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/blocks", () => {
    test("should return 401 when not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getBlocks();

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return empty array when no blocks", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getBlocks();

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(0);
    });

    test("should return blocked users", async () => {
        await using client = await generateClient(users[0]);

        // Block users[1] and users[2]
        await client.blockAccount(users[1].id);
        await client.blockAccount(users[2].id);

        const { ok, data } = await client.getBlocks();

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(2);
        expect(data.map((u) => u.id)).toContain(users[1].id);
        expect(data.map((u) => u.id)).toContain(users[2].id);
    });

    test("should respect limit parameter", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getBlocks({ limit: 1 });

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(1);
    });
});
