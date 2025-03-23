import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestStatuses, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);
const statuses = await getTestStatuses(1, users[0]);

afterAll(async () => {
    await deleteUsers();
});

describe("POST /api/v1/statuses/:id/unreblog", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.unreblogStatus(statuses[0].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if status is not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.unreblogStatus(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should unreblog status", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.unreblogStatus(statuses[0].id);

        expect(ok).toBe(true);
        expect(data.id).toBe(statuses[0].id);
        expect(data.reblogged).toBe(false);
        expect(data.reblog).toBeNull();
    });

    test("should not error when status is not reblogged", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.unreblogStatus(statuses[0].id);

        expect(ok).toBe(true);
        expect(data.reblog).toBeNull();
    });
});
