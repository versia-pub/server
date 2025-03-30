import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/:id/mute
describe("/api/v1/accounts/:id/mute", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.muteAccount(users[1].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.muteAccount(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should mute user", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.muteAccount(users[1].id);

        expect(ok).toBe(true);

        expect(data.muting).toBe(true);
    });

    test("should return 200 if user already muted", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.muteAccount(users[1].id);

        expect(ok).toBe(true);

        expect(data.muting).toBe(true);
    });

    test("should unmute user after duration", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.muteAccount(users[1].id, {
            duration: 1,
        });

        expect(ok).toBe(true);

        expect(data.muting).toBe(true);

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const { data: data2, ok: ok2 } = await client.getRelationship(
            users[1].id,
        );

        expect(ok2).toBe(true);
        expect(data2.muting).toBe(false);
    });
});
