import { afterAll, describe, expect, test } from "bun:test";
import type { Relationship as ApiRelationship } from "@versia/client/types";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/:id/mute
describe("/api/v1/accounts/:id/mute", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/mute`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
        );
        expect(response.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        const response = await fakeRequest(
            "/api/v1/accounts/00000000-0000-0000-0000-000000000000/mute",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
        );
        expect(response.status).toBe(404);
    });

    test("should mute user", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/mute`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
        );
        expect(response.status).toBe(200);

        const relationship = (await response.json()) as ApiRelationship;
        expect(relationship.muting).toBe(true);
    });

    test("should return 200 if user already muted", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/mute`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
        );
        expect(response.status).toBe(200);

        const relationship = (await response.json()) as ApiRelationship;
        expect(relationship.muting).toBe(true);
    });
});
