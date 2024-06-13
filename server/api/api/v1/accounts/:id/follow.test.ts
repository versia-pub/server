import { afterAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import type { Relationship as apiRelationship } from "~/types/mastodon/relationship";
import { meta } from "./follow";

const { users, tokens, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/:id/follow
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", users[1].id),
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                },
            ),
        );
        expect(response.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(
                        ":id",
                        "00000000-0000-0000-0000-000000000000",
                    ),
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
        expect(response.status).toBe(404);
    });

    test("should follow user", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", users[1].id),
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
        expect(response.status).toBe(200);

        const relationship = (await response.json()) as apiRelationship;
        expect(relationship.following).toBe(true);
    });

    test("should return 200 if user already followed", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", users[1].id),
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
        expect(response.status).toBe(200);

        const relationship = (await response.json()) as apiRelationship;
        expect(relationship.following).toBe(true);
    });
});
