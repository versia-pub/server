import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Account as ApiAccount } from "@versia/client/types";
import { generateClient, getTestStatuses, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(5, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    await using client = await generateClient(users[0]);

    for (const status of timeline) {
        await client.favouriteStatus(status.id);
    }
});

// /api/v1/accounts/:id
describe("/api/v1/accounts/:id", () => {
    test("should return 404 if ID is invalid", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.getAccount("invalid-id");

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should return user", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getAccount(users[0].id);

        expect(ok).toBe(true);
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
            statuses_count: 5,
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
                }),
            ]),
        } satisfies ApiAccount);
    });
});
