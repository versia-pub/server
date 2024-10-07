import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@versia/kit/db";
import { eq } from "@versia/kit/drizzle";
import { Applications, Tokens } from "@versia/kit/tables";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { deleteUsers, users } = await getTestUsers(1);
const clientId = "test-client-id";
const redirectUri = "https://example.com/callback";
const scope = "openid profile email";
const secret = "test-secret";

beforeAll(async () => {
    await db.insert(Applications).values({
        clientId,
        redirectUri,
        scopes: scope,
        name: "Test Application",
        secret,
    });

    await db.insert(Tokens).values({
        code: "test-code",
        redirectUri,
        clientId,
        accessToken: "test-access-token",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        tokenType: "Bearer",
        scope,
        userId: users[0].id,
    });
});

afterAll(async () => {
    await deleteUsers();
    await db.delete(Applications).where(eq(Applications.clientId, clientId));
    await db.delete(Tokens).where(eq(Tokens.clientId, clientId));
});

describe("/oauth/token", () => {
    test("should return token with valid inputs", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: "test-code",
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: secret,
            }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.access_token).toBe("test-access-token");
        expect(body.token_type).toBe("Bearer");
        expect(body.expires_in).toBeGreaterThan(0);
    });

    test("should return error for missing code", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: secret,
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("invalid_request");
        expect(body.error_description).toBe("Code is required");
    });

    test("should return error for missing redirect_uri", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: "test-code",
                client_id: clientId,
                client_secret: secret,
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("invalid_request");
        expect(body.error_description).toBe("Redirect URI is required");
    });

    test("should return error for missing client_id", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: "test-code",
                redirect_uri: redirectUri,
                client_secret: secret,
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("invalid_request");
        expect(body.error_description).toBe("Client ID is required");
    });

    test("should return error for invalid client credentials", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: "test-code",
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: "invalid-secret",
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("invalid_client");
        expect(body.error_description).toBe("Invalid client credentials");
    });

    test("should return error for code not found", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: "invalid-code",
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: secret,
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("invalid_grant");
        expect(body.error_description).toBe("Code not found");
    });

    test("should return error for unsupported grant type", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "refresh_token",
                code: "test-code",
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: secret,
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("unsupported_grant_type");
        expect(body.error_description).toBe("Unsupported grant type");
    });
});
