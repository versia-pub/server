import { afterAll, describe, expect, test } from "bun:test";
import type { Relationship as ApiRelationship } from "@versia/client/types";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/:id/block
describe("/api/v1/accounts/:id/block", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/block`,
            {
                method: "POST",
            },
        );
        expect(response.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        const response = await fakeRequest(
            "/api/v1/accounts/00000000-0000-0000-0000-000000000000/block",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );
        expect(response.status).toBe(404);
    });

    test("should block user", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/block`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );
        expect(response.status).toBe(200);

        const relationship = (await response.json()) as ApiRelationship;
        expect(relationship.blocking).toBe(true);
    });

    test("should return 200 if user already blocked", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/block`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );
        expect(response.status).toBe(200);

        const relationship = (await response.json()) as ApiRelationship;
        expect(relationship.blocking).toBe(true);
    });
});
