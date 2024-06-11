import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { eq } from "drizzle-orm";
import { db } from "~/drizzle/db";
import { Users } from "~/drizzle/schema";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./index";

const { users, tokens, deleteUsers } = await getTestUsers(5);

beforeAll(async () => {
    // user0 should be `locked`
    // user1 should follow user0
    // user0 should follow user2
    await db
        .update(Users)
        .set({ isLocked: true })
        .where(eq(Users.id, users[0].id));

    const res1 = await sendTestRequest(
        new Request(
            new URL(
                `/api/v1/accounts/${users[0].id}/follow`,
                config.http.base_url,
            ),
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
        ),
    );

    expect(res1.ok).toBe(true);

    const res2 = await sendTestRequest(
        new Request(
            new URL(
                `/api/v1/accounts/${users[2].id}/follow`,
                config.http.base_url,
            ),
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
        ),
    );

    expect(res2.ok).toBe(true);
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/relationships
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route}?id[]=${users[2].id}`,
                    config.http.base_url,
                ),
            ),
        );

        expect(response.status).toBe(401);
    });

    test("should return relationships", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route}?id[]=${users[2].id}`,
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
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route}?id[]=${users[1].id}`,
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

        const body = await response.json();
        expect(body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    following: false,
                    followed_by: true,
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
