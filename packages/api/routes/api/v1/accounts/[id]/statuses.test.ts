import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
    generateClient,
    getTestStatuses,
    getTestUsers,
} from "~/tests/utils.ts";

const { users, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(5, users[1])).toReversed();
const timeline2 = (await getTestStatuses(5, users[2])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    await using client = await generateClient(users[1]);

    const { ok } = await client.reblogStatus(timeline2[0].id);

    expect(ok).toBe(true);
});

// /api/v1/accounts/:id/statuses
describe("/api/v1/accounts/:id/statuses", () => {
    test("should return 200 with statuses", async () => {
        await using client = await generateClient(users[1]);

        const { data, ok } = await client.getAccountStatuses(users[1].id, {
            limit: 5,
        });

        expect(ok).toBe(true);

        expect(data).toBeArrayOfSize(5);
        // Should have reblogs
        expect(data[0].reblog).toBeDefined();
    });

    test("should exclude reblogs", async () => {
        await using client = await generateClient(users[1]);

        const { data, ok } = await client.getAccountStatuses(users[1].id, {
            exclude_reblogs: true,
            limit: 5,
        });

        expect(ok).toBe(true);

        expect(data).toBeArrayOfSize(5);
        // Should not have reblogs
        expect(data[0].reblog).toBeNull();
    });

    test("should exclude replies", async () => {
        // Create reply
        await using client0 = await generateClient(users[0]);
        await using client1 = await generateClient(users[1]);

        const { ok } = await client1.postStatus("Reply", {
            in_reply_to_id: timeline[0].id,
            local_only: true,
        });

        expect(ok).toBe(true);

        const { data, ok: ok2 } = await client0.getAccountStatuses(
            users[1].id,
            {
                exclude_replies: true,
                limit: 5,
            },
        );

        expect(ok2).toBe(true);

        expect(data).toBeArrayOfSize(5);
        // Should not have replies
        expect(data[0].in_reply_to_id).toBeNull();
    });

    test("should only include pins", async () => {
        await using client0 = await generateClient(users[0]);
        await using client1 = await generateClient(users[1]);

        const { ok, data } = await client0.getAccountStatuses(users[1].id, {
            pinned: true,
        });

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(0);

        // Create pin
        const { ok: ok2 } = await client1.pinStatus(timeline[3].id);

        expect(ok2).toBe(true);

        const { data: data3, ok: ok3 } = await client0.getAccountStatuses(
            users[1].id,
            {
                pinned: true,
            },
        );

        expect(ok3).toBe(true);
        expect(data3).toBeArrayOfSize(1);
        expect(data3[0].id).toBe(timeline[3].id);
    });
});
