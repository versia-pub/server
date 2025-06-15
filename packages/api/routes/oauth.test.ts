import { afterAll, describe, expect, test } from "bun:test";
import type { Token } from "@versia/client/schemas";
import {
    fakeRequest,
    generateClient,
    getTestUsers,
} from "@versia-server/tests";
import type { z } from "zod";

let clientId: string;
let clientSecret: string;
let code: string;
let jwt: string;
let token: z.infer<typeof Token>;
const { users, passwords, deleteUsers } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
});

describe("Login flow", () => {
    test("should create an application", async () => {
        const client = await generateClient(users[0]);

        const { ok, data } = await client.createApp("Test Application", {
            redirect_uris: "https://example.com",
            website: "https://example.com",
            scopes: ["read", "write"],
        });

        expect(ok).toBe(true);
        expect(data).toEqual({
            name: "Test Application",
            website: "https://example.com",
            client_id: expect.any(String),
            client_secret: expect.any(String),
            client_secret_expires_at: "0",
            redirect_uri: "https://example.com",
            redirect_uris: ["https://example.com"],
            scopes: ["read", "write"],
        });

        clientId = data.client_id;
        clientSecret = data.client_secret;
    });

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

    test("should return the authenticated application's credentials", async () => {
        const client = await generateClient(users[0]);

        const { ok, data } = await client.verifyAppCredentials({
            headers: {
                Authorization: `Bearer ${token.access_token}`,
            },
        });

        expect(ok).toBe(true);

        const credentials = data;

        expect(credentials.name).toBe("Test Application");
        expect(credentials.website).toBe("https://example.com");
    });
});
