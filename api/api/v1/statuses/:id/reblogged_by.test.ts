import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Account as ApiAccount } from "@versia/client/types";
import { fakeRequest, getTestStatuses, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(40, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    for (const status of timeline) {
        await fakeRequest(`/api/v1/statuses/${status.id}/reblog`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[1].data.accessToken}`,
            },
        });
    }
});

// /api/v1/statuses/:id/reblogged_by
describe("/api/v1/statuses/:id/reblogged_by", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(
            `/api/v1/statuses/${timeline[0].id}/reblogged_by`,
        );

        expect(response.status).toBe(401);
    });

    test("should return 200 with users", async () => {
        const response = await fakeRequest(
            `/api/v1/statuses/${timeline[0].id}/reblogged_by`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );

        const objects = (await response.json()) as ApiAccount[];

        expect(objects.length).toBe(1);
        for (const [, status] of objects.entries()) {
            expect(status.id).toBe(users[1].id);
            expect(status.username).toBe(users[1].data.username);
        }
    });
});
