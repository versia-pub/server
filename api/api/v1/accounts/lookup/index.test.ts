import { afterAll, describe, expect, test } from "bun:test";
import type { Account as ApiAccount } from "@versia/client/types";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/lookup
describe("/api/v1/accounts/lookup", () => {
    test("should return 200 with users", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/lookup?acct=${users[0].data.username}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const data = (await response.json()) as ApiAccount[];
        expect(data).toEqual(
            expect.objectContaining({
                id: users[0].id,
                username: users[0].data.username,
                display_name: users[0].data.displayName,
                avatar: expect.any(String),
                header: expect.any(String),
            }),
        );
    });

    test("should automatically lowercase the acct", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/lookup?acct=${users[0].data.username.toUpperCase()}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const data = (await response.json()) as ApiAccount[];
        expect(data).toEqual(
            expect.objectContaining({
                id: users[0].id,
                username: users[0].data.username,
                display_name: users[0].data.displayName,
                avatar: expect.any(String),
                header: expect.any(String),
            }),
        );
    });
});
