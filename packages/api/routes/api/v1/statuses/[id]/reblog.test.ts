import { afterAll, describe, expect, test } from "bun:test";
import {
    generateClient,
    getTestStatuses,
    getTestUsers,
} from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(2);
const statuses = await getTestStatuses(1, users[0]);

afterAll(async () => {
    await deleteUsers();
});

describe("POST /api/v1/statuses/:id/reblog", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.reblogStatus(statuses[0].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if status is not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.reblogStatus(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should reblog status", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.reblogStatus(statuses[0].id);

        expect(ok).toBe(true);
        expect(data.reblog?.id).toBe(statuses[0].id);
    });

    test("should not error when status is already reblogged", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.reblogStatus(statuses[0].id);

        expect(ok).toBe(true);
        expect(data.reblog?.id).toBe(statuses[0].id);
    });

    test("should update reblog count on original status", async () => {
        await using client = await generateClient(users[0]);

        // Unreblog the status first
        await client.unreblogStatus(statuses[0].id);

        // Check that the reblog count is 0
        const { ok: ok1, data: data1 } = await client.getStatus(statuses[0].id);

        expect(ok1).toBe(true);
        expect(data1.reblogs_count).toBe(0);

        const { ok: ok2, data: data2 } = await client.reblogStatus(
            statuses[0].id,
        );

        expect(ok2).toBe(true);
        expect(data2.reblog?.reblogs_count).toBe(1);

        const { ok: ok3, data: data3 } = await client.getStatus(statuses[0].id);

        expect(ok3).toBe(true);
        expect(data3.reblogs_count).toBe(1);
    });
});
