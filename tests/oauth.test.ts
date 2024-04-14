import { afterAll, describe, expect, test } from "bun:test";
import type { APIApplication } from "~types/entities/application";
import type { APIToken } from "~types/entities/token";
import {
    deleteOldTestUsers,
    getTestUsers,
    sendTestRequest,
    wrapRelativeUrl,
} from "./utils";

const base_url = "http://lysand.localhost:8080"; //config.http.base_url;

let client_id: string;
let client_secret: string;
let code: string;
let token: APIToken;
const { users, passwords, deleteUsers } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
    await deleteOldTestUsers();
});
describe("POST /api/v1/apps/", () => {
    test("should create an application", async () => {
        const formData = new FormData();

        formData.append("client_name", "Test Application");
        formData.append("website", "https://example.com");
        formData.append("redirect_uris", "https://example.com");
        formData.append("scopes", "read write");

        const response = await sendTestRequest(
            new Request(wrapRelativeUrl("/api/v1/apps/", base_url), {
                method: "POST",
                body: formData,
            }),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const json = await response.json();

        expect(json).toEqual({
            id: expect.any(String),
            name: "Test Application",
            website: "https://example.com",
            client_id: expect.any(String),
            client_secret: expect.any(String),
            redirect_uri: "https://example.com",
            vapid_link: null,
        });

        client_id = json.client_id;
        client_secret = json.client_secret;
    });
});

describe("POST /api/auth/login/", () => {
    test("should get a code", async () => {
        const formData = new FormData();

        formData.append("email", users[0]?.email ?? "");
        formData.append("password", passwords[0]);

        const response = await sendTestRequest(
            new Request(
                wrapRelativeUrl(
                    `/api/auth/login/?client_id=${client_id}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
                    base_url,
                ),
                {
                    method: "POST",
                    body: formData,
                },
            ),
        );

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toMatch(
            /^\/oauth\/redirect\?redirect_uri=https%3A%2F%2Fexample.com&code=[a-f0-9]+&client_id=[a-zA-Z0-9_-]+&application=Test\+Application&website=https%3A%2F%2Fexample.com&scope=read\+write$/,
        );

        code =
            new URL(
                response.headers.get("Location") ?? "",
                "http://lysand.localhost:8080",
            ).searchParams.get("code") ?? "";
    });
});

describe("POST /oauth/token/", () => {
    test("should get an access token", async () => {
        const formData = new FormData();

        formData.append("grant_type", "authorization_code");
        formData.append("code", code);
        formData.append("redirect_uri", "https://example.com");
        formData.append("client_id", client_id);
        formData.append("client_secret", client_secret);
        formData.append("scope", "read+write");

        const response = await sendTestRequest(
            new Request(wrapRelativeUrl("/oauth/token/", base_url), {
                method: "POST",
                body: formData,
            }),
        );

        const json = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");
        expect(json).toEqual({
            access_token: expect.any(String),
            token_type: "Bearer",
            scope: "read write",
            created_at: expect.any(Number),
        });

        token = json;
    });
});

describe("GET /api/v1/apps/verify_credentials", () => {
    test("should return the authenticated application's credentials", async () => {
        const response = await sendTestRequest(
            new Request(
                wrapRelativeUrl("/api/v1/apps/verify_credentials", base_url),
                {
                    headers: {
                        Authorization: `Bearer ${token.access_token}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const credentials = (await response.json()) as Partial<APIApplication>;

        expect(credentials.name).toBe("Test Application");
        expect(credentials.website).toBe("https://example.com");
    });
});
