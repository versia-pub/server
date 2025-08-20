import { afterAll, describe, expect, test } from "bun:test";
import { Application, db } from "@versia-server/kit/db";
import { fakeRequest, getTestUsers } from "@versia-server/tests";
import { randomUUIDv7 } from "bun";
import { eq } from "drizzle-orm";
import { randomString } from "@/math";
import { AuthorizationCodes } from "~/packages/kit/tables/schema";

const { deleteUsers, users } = await getTestUsers(1);

const application = await Application.insert({
    id: randomUUIDv7(),
    redirectUris: ["https://example.com/callback"],
    scopes: ["openid", "profile", "email"],
    secret: "test-secret",
    name: "Test Application",
});

const authorizationCode = (
    await db
        .insert(AuthorizationCodes)
        .values({
            clientId: application.id,
            code: randomString(10),
            redirectUri: application.data.redirectUris[0],
            userId: users[0].id,
            expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
        })
        .returning()
)[0];

afterAll(async () => {
    await deleteUsers();
    await application.delete();
    await db
        .delete(AuthorizationCodes)
        .where(eq(AuthorizationCodes.code, authorizationCode.code));
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
                code: authorizationCode.code,
                redirect_uri: application.data.redirectUris[0],
                client_id: application.data.id,
                client_secret: application.data.secret,
            }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.access_token).toBeString();
        expect(body.token_type).toBe("Bearer");
        expect(body.expires_in).toBeNull();
    });

    test("should return error for missing code", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                redirect_uri: application.data.redirectUris[0],
                client_id: application.data.id,
                client_secret: application.data.secret,
            }),
        });

        expect(response.status).toBe(422);
        const body = await response.json();
        expect(body.error).toInclude(`Expected string at "code"`);
    });

    test("should return error for missing redirect_uri", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: authorizationCode.code,
                client_id: application.data.id,
                client_secret: application.data.secret,
            }),
        });

        expect(response.status).toBe(422);
        const body = await response.json();
        expect(body.error).toInclude(`Expected string at "redirect_uri"`);
    });

    test("should return error for missing client_id", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: authorizationCode.code,
                redirect_uri: application.data.redirectUris[0],
                client_secret: application.data.secret,
            }),
        });

        expect(response.status).toBe(422);
        const body = await response.json();
        expect(body.error).toInclude(`Expected string at "client_id"`);
    });

    test("should return error for invalid client credentials", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: authorizationCode.code,
                redirect_uri: application.data.redirectUris[0],
                client_id: application.data.id,
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
                redirect_uri: application.data.redirectUris[0],
                client_id: application.data.id,
                client_secret: application.data.secret,
            }),
        });

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error).toBe("invalid_grant");
        expect(body.error_description).toBe(
            "Authorization code not found or expired",
        );
    });

    test("should return error for unsupported grant type", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "refresh_token",
                code: authorizationCode.code,
                redirect_uri: application.data.redirectUris[0],
                client_id: application.data.id,
                client_secret: application.data.secret,
            }),
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("unsupported_grant_type");
        expect(body.error_description).toBe("Unsupported grant type");
    });
});
