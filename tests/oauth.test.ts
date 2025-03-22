/**
 * @deprecated
 */
import { afterAll, describe, expect, test } from "bun:test";
import type { z } from "@hono/zod-openapi";
import type { Application, Token } from "@versia/client/schemas";
import { fakeRequest, getTestUsers } from "./utils.ts";

let clientId: string;
let clientSecret: string;
let code: string;
let jwt: string;
let token: z.infer<typeof Token>;
const { users, passwords, deleteUsers } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
});

describe("POST /api/v1/apps/", () => {
    test("should create an application", async () => {
        const formData = new FormData();

        formData.append("client_name", "Test Application");
        formData.append("website", "https://example.com");
        formData.append("redirect_uris", "https://example.com");
        formData.append("scopes", "read write");

        const response = await fakeRequest("/api/v1/apps", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_name: "Test Application",
                website: "https://example.com",
                redirect_uris: "https://example.com",
                scopes: "read write",
            }),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );

        const json = await response.json();

        expect(json).toEqual({
            name: "Test Application",
            website: "https://example.com",
            client_id: expect.any(String),
            client_secret: expect.any(String),
            client_secret_expires_at: "0",
            redirect_uri: "https://example.com",
            redirect_uris: ["https://example.com"],
            scopes: ["read", "write"],
        });

        clientId = json.client_id;
        clientSecret = json.client_secret;
    });
});

describe("POST /api/auth/login/", () => {
    test("should get a JWT", async () => {
        const formData = new FormData();

        formData.append("identifier", users[0]?.data.email ?? "");
        formData.append("password", passwords[0]);

        const response = await fakeRequest(
            `/api/auth/login?client_id=${clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
            {
                method: "POST",
                body: formData,
            },
        );

        expect(response.status).toBe(302);

        jwt =
            response.headers.get("Set-Cookie")?.match(/jwt=([^;]+);/)?.[1] ??
            "";
    });
});

describe("GET /oauth/authorize/", () => {
    test("should get a code", async () => {
        const response = await fakeRequest("/oauth/authorize", {
            method: "POST",
            headers: {
                Cookie: `jwt=${jwt}`,
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: "https://example.com",
                response_type: "code",
                scope: "read write",
                max_age: "604800",
            }),
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBeDefined();
        const locationHeader = new URL(
            response.headers.get("Location") ?? "",
            "",
        );

        expect(locationHeader.origin).toBe("https://example.com");

        code = locationHeader.searchParams.get("code") ?? "";
    });
});

describe("POST /oauth/token/", () => {
    test("should get an access token", async () => {
        const response = await fakeRequest("/oauth/token", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${jwt}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: "https://example.com",
                client_id: clientId,
                client_secret: clientSecret,
                scope: "read write",
            }),
        });

        const json = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );
        expect(json).toEqual({
            access_token: expect.any(String),
            token_type: "Bearer",
            scope: "read write",
            created_at: expect.any(Number),
            expires_in: expect.any(Number),
            id_token: null,
            refresh_token: null,
        });

        token = json;
    });
});

describe("GET /api/v1/apps/verify_credentials", () => {
    test("should return the authenticated application's credentials", async () => {
        const response = await fakeRequest("/api/v1/apps/verify_credentials", {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
            },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );

        const credentials = (await response.json()) as Partial<
            z.infer<typeof Application>
        >;

        expect(credentials.name).toBe("Test Application");
        expect(credentials.website).toBe("https://example.com");
    });
});
