import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
    deleteOldTestUsers,
    getTestStatuses,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import { config } from "~index";
import { meta } from "./index";
import type { APIStatus } from "~types/entities/status";
import type { APIAccount } from "~types/entities/account";
import { getUserUri } from "~database/entities/User";

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
                `/api/v1/statuses/${status.id}/favourite`,
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

// /api/v1/accounts/:id
describe(meta.route, () => {
    test("should return 401 if not authenticated and trying to use following", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route.replace(":id", users[0].id)}?following=true`,
                    config.http.base_url,
                ),
            ),
        );

        expect(response.status).toBe(401);
    });

    test("should return 404 if ID is invalid", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", "invalid"),
                    config.http.base_url,
                ),
            ),
        );
        expect(response.status).toBe(404);
    });

    test("should return user", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", users[0].id),
                    config.http.base_url,
                ),
            ),
        );

        expect(response.status).toBe(200);

        const data = (await response.json()) as APIAccount;
        expect(data).toMatchObject({
            id: users[0].id,
            username: users[0].username,
            display_name: users[0].displayName,
            avatar: expect.any(String),
            header: expect.any(String),
            locked: users[0].isLocked,
            created_at: new Date(users[0].createdAt).toISOString(),
            followers_count: 0,
            following_count: 0,
            statuses_count: 40,
            note: users[0].note,
            acct: users[0].username,
            url: expect.any(String),
            avatar_static: expect.any(String),
            header_static: expect.any(String),
            emojis: [],
            moved: null,
            fields: [],
            bot: false,
            group: false,
            limited: false,
            noindex: false,
            suspended: false,
            pleroma: {
                is_admin: false,
                is_moderator: false,
            },
        } satisfies APIAccount);
    });
});
