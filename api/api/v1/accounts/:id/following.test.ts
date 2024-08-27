import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Account as ApiAccount } from "@versia/client/types";
import { fakeRequest, getTestUsers } from "~/tests/utils";
import { meta } from "./following";

const { users, tokens, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    // Follow user
    const response = await fakeRequest(
        `/api/v1/accounts/${users[1].id}/follow`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        },
    );

    expect(response.status).toBe(200);
});

// /api/v1/accounts/:id/following
describe(meta.route, () => {
    test("should return 200 with following", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", users[0].id),
            {
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const data = (await response.json()) as ApiAccount[];

        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBe(1);
        expect(data[0].id).toBe(users[1].id);
    });

    test("should return no following after unfollowing", async () => {
        // Unfollow user
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/unfollow`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const response2 = await fakeRequest(
            meta.route.replace(":id", users[0].id),
            {
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
            },
        );

        expect(response2.status).toBe(200);

        const data = (await response2.json()) as ApiAccount[];

        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBe(0);
    });
});
