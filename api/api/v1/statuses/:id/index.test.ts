import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestStatuses, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);
const statuses = await getTestStatuses(1, users[0]);

afterAll(async () => {
    await deleteUsers();
});

describe("GET /api/v1/statuses/:id", () => {
    test("should return status", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getStatus(statuses[0].id);

        expect(ok).toBe(true);
        expect(data.id).toBe(statuses[0].id);
    });

    test("should return 404 if status is not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.getStatus(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should return 401 when trying to delete status that is not yours", async () => {
        await using client = await generateClient(users[1]);

        const { ok, raw } = await client.deleteStatus(statuses[0].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should delete status", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.deleteStatus(statuses[0].id);

        expect(ok).toBe(true);
    });

    test("should return 404 if status is deleted", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.getStatus(statuses[0].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });
});
