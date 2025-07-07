import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
    generateClient,
    getTestStatuses,
    getTestUsers,
} from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(3);
const statuses = await getTestStatuses(1, users[0]);

let replyId: string;
let replyToReplyId: string;

beforeAll(async () => {
    await using client = await generateClient(users[0]);

    const { ok, data } = await client.postStatus("Test reply", {
        in_reply_to_id: statuses[0].id,
    });

    expect(ok).toBe(true);

    replyId = data.id;

    const { ok: ok2, data: data2 } = await client.postStatus(
        "Test reply to reply",
        {
            in_reply_to_id: replyId,
        },
    );

    expect(ok2).toBe(true);
    replyToReplyId = data2.id;
});

afterAll(async () => {
    await deleteUsers();
});

describe("GET /api/v1/statuses/:id/context", () => {
    test("should return 404 if status is not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.getStatusContext(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should return context of status", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getStatusContext(statuses[0].id);

        expect(ok).toBe(true);
        expect(data.ancestors).toBeArrayOfSize(0);
        expect(data.descendants).toBeArrayOfSize(2);
        expect(data.descendants[0].id).toBe(replyId);
        expect(data.descendants[1].id).toBe(replyToReplyId);
    });

    test("should return context of reply", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getStatusContext(replyId);

        expect(ok).toBe(true);
        expect(data.ancestors).toBeArrayOfSize(1);
        expect(data.ancestors[0].id).toBe(statuses[0].id);
        expect(data.descendants).toBeArrayOfSize(1);
        expect(data.descendants[0].id).toBe(replyToReplyId);
    });

    test("should return context of reply to reply", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getStatusContext(replyToReplyId);

        expect(ok).toBe(true);
        expect(data.ancestors).toBeArrayOfSize(2);
        expect(data.ancestors[0].id).toBe(statuses[0].id);
        expect(data.ancestors[1].id).toBe(replyId);
        expect(data.descendants).toBeArrayOfSize(0);
    });
});
