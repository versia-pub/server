import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Account as ApiAccount } from "@versia/client/types";
import { fakeRequest, getTestStatuses, getTestUsers } from "~/tests/utils";
import { meta } from "./index";

const { users, tokens, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(40, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    for (const status of timeline) {
        await fakeRequest(`/api/v1/statuses/${status.id}/favourite`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[1].accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
    }
});

// /api/v1/accounts/:id
describe(meta.route, () => {
    test("should return 404 if ID is invalid", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", "invalid"),
        );
        expect(response.status).toBe(422);
    });

    test("should return user", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", users[0].id),
        );

        expect(response.status).toBe(200);

        const data = (await response.json()) as ApiAccount;
        expect(data).toMatchObject({
            id: users[0].id,
            username: users[0].data.username,
            display_name: users[0].data.displayName,
            avatar: expect.any(String),
            header: expect.any(String),
            locked: users[0].data.isLocked,
            created_at: new Date(users[0].data.createdAt).toISOString(),
            followers_count: 0,
            following_count: 0,
            statuses_count: 40,
            note: users[0].data.note,
            acct: users[0].data.username,
            uri: expect.any(String),
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
            roles: expect.arrayContaining([
                expect.objectContaining({
                    id: "default",
                    name: "Default",
                    priority: 0,
                    description: "Default role for all users",
                    visible: false,
                    icon: null,
                }),
            ]),
        } satisfies ApiAccount);
    });
});
