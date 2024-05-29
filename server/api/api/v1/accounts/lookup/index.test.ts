import { afterAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { getTestUsers, sendTestRequest } from "~tests/utils";
import type { Account as APIAccount } from "~types/mastodon/account";
import { meta } from "./index";

const { users, tokens, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/lookup
describe(meta.route, () => {
    test("should return 200 with users", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route}?acct=${users[0].getUser().username}`,
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

        const data = (await response.json()) as APIAccount[];
        expect(data).toEqual(
            expect.objectContaining({
                id: users[0].id,
                username: users[0].getUser().username,
                display_name: users[0].getUser().displayName,
                avatar: expect.any(String),
                header: expect.any(String),
            }),
        );
    });
});
