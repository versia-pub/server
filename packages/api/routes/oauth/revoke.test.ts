import { afterAll, describe, expect, test } from "bun:test";
import { Client, Token } from "@versia-server/kit/db";
import { fakeRequest, getTestUsers } from "@versia-server/tests";
import { randomUUIDv7 } from "bun";

const { deleteUsers, users } = await getTestUsers(1);

const application = await Client.insert({
    id: randomUUIDv7(),
    redirectUris: ["https://example.com/callback"],
    scopes: ["openid", "profile", "email"],
    secret: "test-secret",
    name: "Test Application",
});

const token = await Token.insert({
    id: randomUUIDv7(),
    clientId: application.id,
    accessToken: "test-access-token",
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    scopes: application.data.scopes,
    userId: users[0].id,
});

afterAll(async () => {
    await deleteUsers();
    await application.delete();
    await token.delete();
});

describe("/oauth/revoke", () => {
    test("should revoke token with valid inputs", async () => {
        const response = await fakeRequest("/oauth/revoke", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: application.data.id,
                client_secret: application.data.secret,
                token: "test-access-token",
            }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({});
    });

    test("should return error for missing token", async () => {
        const response = await fakeRequest("/oauth/revoke", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: application.data.id,
                client_secret: application.data.secret,
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("unauthorized_client");
        expect(body.error_description).toBe(
            "You are not authorized to revoke this token",
        );
    });

    test("should return error for invalid client credentials", async () => {
        const response = await fakeRequest("/oauth/revoke", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: application.data.id,
                client_secret: "invalid-secret",
                token: "test-access-token",
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("unauthorized_client");
        expect(body.error_description).toBe(
            "You are not authorized to revoke this token",
        );
    });

    test("should return error for token not found", async () => {
        const response = await fakeRequest("/oauth/revoke", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: application.data.id,
                client_secret: application.data.secret,
                token: "invalid-token",
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("unauthorized_client");
        expect(body.error_description).toBe(
            "You are not authorized to revoke this token",
        );
    });

    test("should return error for unauthorized client", async () => {
        const response = await fakeRequest("/oauth/revoke", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: "unauthorized-client-id",
                client_secret: application.data.secret,
                token: "test-access-token",
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("unauthorized_client");
        expect(body.error_description).toBe(
            "You are not authorized to revoke this token",
        );
    });
});
