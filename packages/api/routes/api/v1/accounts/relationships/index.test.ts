import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { generateClient, getTestUsers } from "@versia-server/tests";
import { eq } from "drizzle-orm";

const { users, deleteUsers } = await getTestUsers(5);

beforeAll(async () => {
    // user0 should be `locked`
    // user1 should follow user0
    // user0 should follow user2
    await db
        .update(Users)
        .set({ isLocked: true })
        .where(eq(Users.id, users[0].id));

    await using client1 = await generateClient(users[1]);

    const { ok } = await client1.followAccount(users[0].id);

    expect(ok).toBe(true);

    await using client0 = await generateClient(users[0]);

    const { ok: ok2 } = await client0.followAccount(users[2].id);

    expect(ok2).toBe(true);
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/relationships
describe("/api/v1/accounts/relationships", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getRelationships([users[2].id]);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return relationships", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getRelationships([users[2].id]);

        expect(ok).toBe(true);
        expect(data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: users[2].id,
                    following: true,
                    followed_by: false,
                    blocking: false,
                    muting: false,
                    muting_notifications: false,
                    requested: false,
                    domain_blocking: false,
                    endorsed: false,
                }),
            ]),
        );
    });

    test("should be requested_by user1", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getRelationships([users[1].id]);

        expect(ok).toBe(true);
        expect(data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    following: false,
                    followed_by: false,
                    blocking: false,
                    muting: false,
                    muting_notifications: false,
                    requested_by: true,
                    domain_blocking: false,
                    endorsed: false,
                }),
            ]),
        );
    });
});
