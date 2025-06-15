import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/accounts/:id/note", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.updateAccountNote(users[1].id, "test");

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.updateAccountNote(
            "00000000-0000-0000-0000-000000000000",
            "test",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should update note", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.updateAccountNote(
            users[1].id,
            "test",
        );

        expect(ok).toBe(true);
        expect(data.note).toBe("test");
    });

    test("should return 200 if note is null", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.updateAccountNote(users[1].id, null);

        expect(ok).toBe(true);
        expect(data.note).toBe("");
    });

    test("should return 422 if note is too long", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.updateAccountNote(
            users[1].id,
            "a".repeat(10_000),
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });
});
