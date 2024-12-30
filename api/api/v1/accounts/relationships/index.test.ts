import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { eq } from "drizzle-orm";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(5);

beforeAll(async () => {
    // user0 should be `locked`
    // user1 should follow user0
    // user0 should follow user2
    await db
        .update(Users)
        .set({ isLocked: true })
        .where(eq(Users.id, users[0].id));

    const res1 = await fakeRequest(`/api/v1/accounts/${users[0].id}/follow`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens[1].data.accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    expect(res1.ok).toBe(true);

    const res2 = await fakeRequest(`/api/v1/accounts/${users[2].id}/follow`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens[0].data.accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    expect(res2.ok).toBe(true);
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/relationships
describe("/api/v1/accounts/relationships", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/relationships?id[]=${users[2].id}`,
        );

        expect(response.status).toBe(401);
    });

    test("should return relationships", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/relationships?id[]=${users[2].id}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual(
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
        const response = await fakeRequest(
            `/api/v1/accounts/relationships?id[]=${users[1].id}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual(
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
