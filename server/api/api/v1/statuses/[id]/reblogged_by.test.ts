import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
    deleteOldTestUsers,
    getTestStatuses,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import { config } from "~index";
import { meta } from "./reblogged_by";
import type { APIStatus } from "~types/entities/status";
import type { APIAccount } from "~types/entities/account";

await deleteOldTestUsers();

const { users, tokens, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(40, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    for (const status of timeline) {
        await fetch(
            new URL(
                `/api/v1/statuses/${status.id}/reblog`,
                config.http.base_url,
            ),
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
            },
        );
    }
});

// /api/v1/statuses/:id/reblogged_by
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", timeline[0].id),
                    config.http.base_url,
                ),
            ),
        );

        expect(response.status).toBe(401);
    });

    test("should return 400 if limit is less than 1", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route.replace(":id", timeline[0].id)}?limit=0`,
                    config.http.base_url,
                ),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(400);
    });

    test("should return 400 if limit is greater than 80", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route.replace(":id", timeline[0].id)}?limit=100`,
                    config.http.base_url,
                ),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(400);
    });

    test("should return 200 with users", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", timeline[0].id),
                    config.http.base_url,
                ),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const objects = (await response.json()) as APIAccount[];

        expect(objects.length).toBe(1);
        for (const [index, status] of objects.entries()) {
            expect(status.id).toBe(users[1].id);
            expect(status.username).toBe(users[1].username);
        }
    });
});
