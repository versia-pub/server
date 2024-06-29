import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Status as ApiStatus } from "@lysand-org/client/types";
import { config } from "config-manager";
import { getTestStatuses, getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./statuses";

const { users, tokens, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(40, users[1])).toReversed();
const timeline2 = (await getTestStatuses(40, users[2])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    const response = await sendTestRequest(
        new Request(
            new URL(
                `/api/v1/statuses/${timeline2[0].id}/reblog`,
                config.http.base_url,
            ),
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
            },
        ),
    );

    expect(response.status).toBe(200);
});

// /api/v1/accounts/:id/statuses
describe(meta.route, () => {
    test("should return 200 with statuses", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", users[1].id),
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

        const data = (await response.json()) as ApiStatus[];

        expect(data.length).toBe(20);
        // Should have reblogs
        expect(data[0].reblog).toBeDefined();
    });

    test("should exclude reblogs", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route.replace(
                        ":id",
                        users[1].id,
                    )}?exclude_reblogs=true`,
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

        const data = (await response.json()) as ApiStatus[];

        expect(data.length).toBe(20);
        // Should not have reblogs
        expect(data[0].reblog).toBeNull();
    });

    test("should exclude replies", async () => {
        // Create reply
        const replyResponse = await sendTestRequest(
            new Request(new URL("/api/v1/statuses", config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Reply",
                    in_reply_to_id: timeline[0].id,
                    local_only: "true",
                }),
            }),
        );

        expect(replyResponse.status).toBe(200);

        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route.replace(
                        ":id",
                        users[1].id,
                    )}?exclude_replies=true`,
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

        const data = (await response.json()) as ApiStatus[];

        expect(data.length).toBe(20);
        // Should not have replies
        expect(data[0].in_reply_to_id).toBeNull();
    });

    test("should only include pins", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route.replace(":id", users[1].id)}?pinned=true`,
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

        const data = (await response.json()) as ApiStatus[];

        expect(data.length).toBe(0);

        // Create pin
        const pinResponse = await sendTestRequest(
            new Request(
                new URL(
                    `/api/v1/statuses/${timeline[3].id}/pin`,
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[1].accessToken}`,
                    },
                },
            ),
        );

        expect(pinResponse.status).toBe(200);

        const response2 = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route.replace(":id", users[1].id)}?pinned=true`,
                    config.http.base_url,
                ),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response2.status).toBe(200);

        const data2 = (await response2.json()) as ApiStatus[];

        expect(data2.length).toBe(1);
    });
});
