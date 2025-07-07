import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(3);

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    await using client = await generateClient(users[0]);

    const { ok } = await client.muteAccount(users[1].id);

    expect(ok).toBe(true);
});

// /api/v1/mutes
describe("/api/v1/mutes", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getMutes();

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return mutes", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getMutes();

        expect(ok).toBe(true);
        expect(data).toEqual([
            expect.objectContaining({
                id: users[1].id,
            }),
        ]);
    });

    test("should return mutes after unmute", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.unmuteAccount(users[1].id);

        expect(ok).toBe(true);

        const { data, ok: ok2 } = await client.getMutes();

        expect(ok2).toBe(true);
        expect(data).toEqual([]);
    });
});
