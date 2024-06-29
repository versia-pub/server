import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Account as ApiAccount } from "@lysand-org/client/types";
import { config } from "config-manager";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./followers";

const { users, tokens, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    // Follow user
    const response = await sendTestRequest(
        new Request(
            new URL(
                `/api/v1/accounts/${users[1].id}/follow`,
                config.http.base_url,
            ),
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
        ),
    );

    expect(response.status).toBe(200);
});

// /api/v1/accounts/:id/followers
describe(meta.route, () => {
    test("should return 200 with followers", async () => {
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

        const data = (await response.json()) as ApiAccount[];

        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBe(1);
        expect(data[0].id).toBe(users[0].id);
    });

    test("should return no followers after unfollowing", async () => {
        // Unfollow user
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `/api/v1/accounts/${users[1].id}/unfollow`,
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(200);

        const response2 = await sendTestRequest(
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

        expect(response2.status).toBe(200);

        const data = (await response2.json()) as ApiAccount[];

        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBe(0);
    });
});
