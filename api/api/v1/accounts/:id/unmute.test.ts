import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Relationship as ApiRelationship } from "@versia/client/types";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

beforeAll(async () => {
    await fakeRequest(`/api/v1/accounts/${users[0].id}/mute`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens[1].data.accessToken}`,
        },
    });
});

// /api/v1/accounts/:id/unmute
describe("/api/v1/accounts/:id/unmute", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/unmute`,
            {
                method: "POST",
            },
        );
        expect(response.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        const response = await fakeRequest(
            "/api/v1/accounts/00000000-0000-0000-0000-000000000000/unmute",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );
        expect(response.status).toBe(404);
    });

    test("should unmute user", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/unmute`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );
        expect(response.status).toBe(200);

        const relationship = (await response.json()) as ApiRelationship;
        expect(relationship.muting).toBe(false);
    });

    test("should return 200 if user already unmuted", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/unmute`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );
        expect(response.status).toBe(200);

        const relationship = (await response.json()) as ApiRelationship;
        expect(relationship.muting).toBe(false);
    });
});
