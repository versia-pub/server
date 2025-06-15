import { afterAll, describe, expect, test } from "bun:test";
import {
    generateClient,
    getTestStatuses,
    getTestUsers,
} from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(1);
const timeline = await getTestStatuses(10, users[0]);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/markers
describe("/api/v1/markers", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getMarkers(["home", "notifications"]);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return empty markers", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getMarkers(["home", "notifications"]);

        expect(ok).toBe(true);
        expect(data).toEqual({});
    });

    test("should create markers", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.saveMarkers({
            home: {
                last_read_id: timeline[0].id,
            },
        });

        expect(ok).toBe(true);
        expect(data).toEqual({
            home: {
                last_read_id: timeline[0].id,
                updated_at: expect.any(String),
                version: 1,
            },
        });
    });

    test("should return markers", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getMarkers(["home", "notifications"]);

        expect(ok).toBe(true);
        expect(data).toEqual({
            home: {
                last_read_id: timeline[0].id,
                updated_at: expect.any(String),
                version: 1,
            },
        });
    });
});
