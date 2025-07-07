import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
    generateClient,
    getTestStatuses,
    getTestUsers,
} from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(5, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    await using client = await generateClient(users[1]);

    for (const status of timeline) {
        await client.reblogStatus(status.id);
    }
});

describe("/api/v1/statuses/:id/reblogged_by", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getStatusRebloggedBy(timeline[0].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 200 with users", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getStatusRebloggedBy(timeline[0].id);

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(1);

        expect(data.length).toBe(1);
        expect(data[0].id).toBe(users[1].id);
        expect(data[0].username).toBe(users[1].data.username);
    });
});
