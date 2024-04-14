import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getUserUri } from "~database/entities/User";
import { config } from "~index";
import {
    deleteOldTestUsers,
    getTestStatuses,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import type { APIAccount } from "~types/entities/account";
import type { APIStatus } from "~types/entities/status";
import { meta } from "./index";

await deleteOldTestUsers();

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
                    `${meta.route}?acct=${users[0].username}`,
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
                username: users[0].username,
                display_name: users[0].displayName,
                avatar: expect.any(String),
                header: expect.any(String),
            }),
        );
    });
});
