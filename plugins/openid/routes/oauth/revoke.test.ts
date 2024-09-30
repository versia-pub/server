import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "~/drizzle/db";
import { Applications, Tokens } from "~/drizzle/schema";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { deleteUsers, users } = await getTestUsers(1);
const clientId = "test-client-id";
const redirectUri = "https://example.com/callback";
const scope = "openid profile email";
const secret = "test-secret";

beforeAll(async () => {
    const application = (
        await db
            .insert(Applications)
            .values({
                clientId: clientId,
                redirectUri: redirectUri,
                scopes: scope,
                name: "Test Application",
                secret,
            })
            .returning()
    )[0];

    await db.insert(Tokens).values({
        code: "test-code",
        redirectUri: redirectUri,
        clientId: clientId,
        accessToken: "test-access-token",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        tokenType: "Bearer",
        scope,
        userId: users[0].id,
        applicationId: application.id,
    });
});

afterAll(async () => {
    await deleteUsers();
    await db.delete(Applications).where(eq(Applications.clientId, clientId));
    await db.delete(Tokens).where(eq(Tokens.clientId, clientId));
});

describe("/oauth/revoke", () => {
    test("should revoke token with valid inputs", async () => {
        const response = await fakeRequest("/oauth/revoke", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: secret,
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
                client_id: clientId,
                client_secret: secret,
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
                client_id: clientId,
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
                client_id: clientId,
                client_secret: secret,
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
                client_secret: secret,
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
