import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    await using client = await generateClient(users[0]);

    const { ok } = await client.muteAccount(users[1].id);

    expect(ok).toBe(true);
});

// /api/v1/accounts/:id/unmute
describe("/api/v1/accounts/:id/unmute", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.unmuteAccount(users[0].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.unmuteAccount(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should unmute user", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.unmuteAccount(users[1].id);

        expect(ok).toBe(true);
        expect(data.muting).toBe(false);
    });

    test("should return 200 if user already unmuted", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.unmuteAccount(users[1].id);

        expect(ok).toBe(true);
        expect(data.muting).toBe(false);
    });
});
