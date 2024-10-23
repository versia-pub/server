import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@versia/kit/db";
import { eq } from "@versia/kit/drizzle";
import { Tokens } from "@versia/kit/tables";
import { Application } from "~/packages/database-interface/application";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { deleteUsers, users } = await getTestUsers(1);

const application = await Application.insert({
    clientId: "test-client-id",
    redirectUri: "https://example.com/callback",
    scopes: "openid profile email",
    secret: "test-secret",
    name: "Test Application",
});

beforeAll(async () => {
    await db.insert(Tokens).values({
        code: "test-code",
        redirectUri: application.data.redirectUri,
        clientId: application.data.clientId,
        accessToken: "test-access-token",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        tokenType: "Bearer",
        scope: application.data.scopes,
        userId: users[0].id,
        applicationId: application.id,
    });
});

afterAll(async () => {
    await deleteUsers();
    await application.delete();
    await db
        .delete(Tokens)
        .where(eq(Tokens.clientId, application.data.clientId));
});

describe("/oauth/revoke", () => {
    test("should revoke token with valid inputs", async () => {
        const response = await fakeRequest("/oauth/revoke", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: application.data.clientId,
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
                client_id: application.data.clientId,
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
                client_id: application.data.clientId,
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
                client_id: application.data.clientId,
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
