import { afterAll, describe, expect, test } from "bun:test";
import { RolePermission } from "@versia/client/schemas";
import { Application } from "@versia/kit/db";
import { randomUUIDv7 } from "bun";
import { SignJWT } from "jose";
import { randomString } from "@/math";
import { config } from "~/config.ts";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { deleteUsers, tokens, users } = await getTestUsers(1);
const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(
        config.plugins?.config?.["@versia/openid"].keys.private,
        "base64",
    ),
    "Ed25519",
    false,
    ["sign"],
);

const application = await Application.insert({
    id: randomUUIDv7(),
    clientId: "test-client-id",
    redirectUri: "https://example.com/callback",
    scopes: "openid profile email",
    name: "Test Application",
    secret: "test-secret",
});

afterAll(async () => {
    await deleteUsers();
    await application.delete();
});

describe("/oauth/authorize", () => {
    test("should authorize and redirect with valid inputs", async () => {
        const jwt = await new SignJWT({
            sub: users[0].id,
            iss: config.http.base_url.origin,
            aud: application.data.clientId,
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000),
        })
            .setProtectedHeader({ alg: "EdDSA" })
            .sign(privateKey);

        const response = await fakeRequest("/oauth/authorize", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
                Cookie: `jwt=${jwt}`,
            },
            body: JSON.stringify({
                client_id: application.data.clientId,
                redirect_uri: application.data.redirectUri,
                response_type: "code",
                scope: application.data.scopes,
                state: "test-state",
                code_challenge: randomString(43),
                code_challenge_method: "S256",
            }),
        });

        expect(response.status).toBe(302);
        const location = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );
        const params = new URLSearchParams(location.search);
        expect(location.origin + location.pathname).toBe(
            application.data.redirectUri,
        );
        expect(params.get("code")).toBeTruthy();
        expect(params.get("state")).toBe("test-state");
    });

    test("should return error for invalid JWT", async () => {
        const response = await fakeRequest("/oauth/authorize", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
                Cookie: "jwt=invalid-jwt",
            },
            body: JSON.stringify({
                client_id: application.data.clientId,
                redirect_uri: application.data.redirectUri,
                response_type: "code",
                scope: application.data.scopes,
                state: "test-state",
                code_challenge: randomString(43),
                code_challenge_method: "S256",
            }),
        });

        expect(response.status).toBe(302);
        const location = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );
        const params = new URLSearchParams(location.search);
        expect(params.get("error")).toBe("invalid_request");
        expect(params.get("error_description")).toBe(
            "Invalid JWT: could not verify",
        );
    });

    test("should return error for missing required fields in JWT", async () => {
        const jwt = await new SignJWT({
            sub: users[0].id,
            iss: config.http.base_url.origin,
            aud: application.data.clientId,
        })
            .setProtectedHeader({ alg: "EdDSA" })
            .sign(privateKey);

        const response = await fakeRequest("/oauth/authorize", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
                Cookie: `jwt=${jwt}`,
            },
            body: JSON.stringify({
                client_id: application.data.clientId,
                redirect_uri: application.data.redirectUri,
                response_type: "code",
                scope: application.data.scopes,
                state: "test-state",
                code_challenge: randomString(43),
                code_challenge_method: "S256",
            }),
        });

        expect(response.status).toBe(302);
        const location = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );
        const params = new URLSearchParams(location.search);
        expect(params.get("error")).toBe("invalid_request");
        expect(params.get("error_description")).toBe(
            "Invalid JWT: missing required fields (aud, sub, exp, iss)",
        );
    });

    test("should return error for user not found", async () => {
        const jwt = await new SignJWT({
            sub: "non-existent-user",
            aud: application.data.clientId,
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            iss: config.http.base_url.origin,
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000),
        })
            .setProtectedHeader({ alg: "EdDSA" })
            .sign(privateKey);

        const response = await fakeRequest("/oauth/authorize", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
                Cookie: `jwt=${jwt}`,
            },
            body: JSON.stringify({
                client_id: application.data.clientId,
                redirect_uri: application.data.redirectUri,
                response_type: "code",
                scope: application.data.scopes,
                state: "test-state",
                code_challenge: randomString(43),
                code_challenge_method: "S256",
            }),
        });

        expect(response.status).toBe(302);
        const location = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );
        const params = new URLSearchParams(location.search);
        expect(params.get("error")).toBe("invalid_request");
        expect(params.get("error_description")).toBe(
            "Invalid JWT: sub is not a valid user ID",
        );

        const jwt2 = await new SignJWT({
            sub: "23e42862-d5df-49a8-95b5-52d8c6a11aea",
            aud: application.data.clientId,
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            iss: config.http.base_url.origin,
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000),
        })
            .setProtectedHeader({ alg: "EdDSA" })
            .sign(privateKey);

        const response2 = await fakeRequest("/oauth/authorize", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
                Cookie: `jwt=${jwt2}`,
            },
            body: JSON.stringify({
                client_id: application.data.clientId,
                redirect_uri: application.data.redirectUri,
                response_type: "code",
                scope: application.data.scopes,
                state: "test-state",
                code_challenge: randomString(43),
                code_challenge_method: "S256",
            }),
        });

        expect(response2.status).toBe(302);
        const location2 = new URL(
            response2.headers.get("Location") ?? "",
            config.http.base_url,
        );
        const params2 = new URLSearchParams(location2.search);
        expect(params2.get("error")).toBe("invalid_request");
        expect(params2.get("error_description")).toBe(
            "Invalid JWT, could not find associated user",
        );
    });

    test("should return error for user missing required permissions", async () => {
        const oldPermissions = config.permissions.default;
        config.permissions.default = [];

        const jwt = await new SignJWT({
            sub: users[0].id,
            iss: config.http.base_url.origin,
            aud: application.data.clientId,
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000),
        })
            .setProtectedHeader({ alg: "EdDSA" })
            .sign(privateKey);

        const response = await fakeRequest("/oauth/authorize", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
                Cookie: `jwt=${jwt}`,
            },
            body: JSON.stringify({
                client_id: application.data.clientId,
                redirect_uri: application.data.redirectUri,
                response_type: "code",
                scope: application.data.scopes,
                state: "test-state",
                code_challenge: randomString(43),
                code_challenge_method: "S256",
            }),
        });

        expect(response.status).toBe(302);
        const location = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );
        const params = new URLSearchParams(location.search);
        expect(params.get("error")).toBe("unauthorized");
        expect(params.get("error_description")).toBe(
            `User missing required '${RolePermission.OAuth}' permission`,
        );

        config.permissions.default = oldPermissions;
    });

    test("should return error for invalid client_id", async () => {
        const jwt = await new SignJWT({
            sub: users[0].id,
            aud: "invalid-client-id",
            iss: config.http.base_url.origin,
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000),
        })
            .setProtectedHeader({ alg: "EdDSA" })
            .sign(privateKey);

        const response = await fakeRequest("/oauth/authorize", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
                Cookie: `jwt=${jwt}`,
            },
            body: JSON.stringify({
                client_id: "invalid-client-id",
                redirect_uri: application.data.redirectUri,
                response_type: "code",
                scope: application.data.scopes,
                state: "test-state",
                code_challenge: randomString(43),
                code_challenge_method: "S256",
            }),
        });

        expect(response.status).toBe(302);
        const location = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );
        const params = new URLSearchParams(location.search);
        expect(params.get("error")).toBe("invalid_request");
        expect(params.get("error_description")).toBe(
            "Invalid client_id: no associated API application found",
        );
    });

    test("should return error for invalid redirect_uri", async () => {
        const jwt = await new SignJWT({
            sub: users[0].id,
            iss: config.http.base_url.origin,
            aud: application.data.clientId,
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000),
        })
            .setProtectedHeader({ alg: "EdDSA" })
            .sign(privateKey);

        const response = await fakeRequest("/oauth/authorize", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
                Cookie: `jwt=${jwt}`,
            },
            body: JSON.stringify({
                client_id: application.data.clientId,
                redirect_uri: "https://invalid.com/callback",
                response_type: "code",
                scope: application.data.scopes,
                state: "test-state",
                code_challenge: randomString(43),
                code_challenge_method: "S256",
            }),
        });

        expect(response.status).toBe(302);
        const location = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );
        const params = new URLSearchParams(location.search);
        expect(params.get("error")).toBe("invalid_request");
        expect(params.get("error_description")).toBe(
            "Invalid redirect_uri: does not match API application's redirect_uri",
        );
    });

    test("should return error for invalid scope", async () => {
        const jwt = await new SignJWT({
            sub: users[0].id,
            iss: config.http.base_url.origin,
            aud: application.data.clientId,
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000),
        })
            .setProtectedHeader({ alg: "EdDSA" })
            .sign(privateKey);

        const response = await fakeRequest("/oauth/authorize", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
                Cookie: `jwt=${jwt}`,
            },
            body: JSON.stringify({
                client_id: application.data.clientId,
                redirect_uri: application.data.redirectUri,
                response_type: "code",
                scope: "invalid-scope",
                state: "test-state",
                code_challenge: randomString(43),
                code_challenge_method: "S256",
            }),
        });

        expect(response.status).toBe(302);
        const location = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );
        const params = new URLSearchParams(location.search);
        expect(params.get("error")).toBe("invalid_request");
        expect(params.get("error_description")).toBe(
            "Invalid scope: not a subset of the application's scopes",
        );
    });
});
