import { afterAll, describe, expect, test } from "bun:test";
import { config } from "~index";
import {
    deleteOldTestUsers,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import type { Account as APIAccount } from "~types/mastodon/account";
import { meta } from "./index";

await deleteOldTestUsers();

const { users, tokens, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/search
describe(meta.route, () => {
    test("should return 200 with users", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route}?q=${users[0].username}`,
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
            expect.arrayContaining([
                expect.objectContaining({
                    id: users[0].id,
                    username: users[0].username,
                    display_name: users[0].displayName,
                    avatar: expect.any(String),
                    header: expect.any(String),
                }),
            ]),
        );
    });
});
