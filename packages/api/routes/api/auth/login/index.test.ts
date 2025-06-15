import { afterAll, describe, expect, test } from "bun:test";
import { Application } from "@versia/kit/db";
import { config } from "@versia-server/config";
import { randomUUIDv7 } from "bun";
import { randomString } from "@/math";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, deleteUsers, passwords } = await getTestUsers(1);

// Create application
const application = await Application.insert({
    id: randomUUIDv7(),
    name: "Test Application",
    clientId: randomString(32, "hex"),
    secret: "test",
    redirectUri: "https://example.com",
    scopes: "read write",
});

afterAll(async () => {
    await deleteUsers();
    await application.delete();
});

// /api/auth/login
describe("/api/auth/login", () => {
    test("should get a JWT with email", async () => {
        const formData = new FormData();

        formData.append("identifier", users[0]?.data.email ?? "");
        formData.append("password", passwords[0]);

        const response = await fakeRequest(
            `/api/auth/login?client_id=${application.data.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
            {
                method: "POST",
                body: formData,
            },
        );

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBeDefined();
        const locationHeader = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );

        expect(locationHeader.pathname).toBe("/oauth/consent");
        expect(locationHeader.searchParams.get("client_id")).toBe(
            application.data.clientId,
        );
        expect(locationHeader.searchParams.get("redirect_uri")).toBe(
            "https://example.com",
        );
        expect(locationHeader.searchParams.get("response_type")).toBe("code");
        expect(locationHeader.searchParams.get("scope")).toBe("read write");

        expect(response.headers.get("Set-Cookie")).toMatch(/jwt=[^;]+;/);
    });

    test("should get a JWT with username", async () => {
        const formData = new FormData();

        formData.append("identifier", users[0]?.data.username ?? "");
        formData.append("password", passwords[0]);

        const response = await fakeRequest(
            `/api/auth/login?client_id=${application.data.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
            {
                method: "POST",
                body: formData,
            },
        );

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBeDefined();
        const locationHeader = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );

        expect(locationHeader.pathname).toBe("/oauth/consent");
        expect(locationHeader.searchParams.get("client_id")).toBe(
            application.data.clientId,
        );
        expect(locationHeader.searchParams.get("redirect_uri")).toBe(
            "https://example.com",
        );
        expect(locationHeader.searchParams.get("response_type")).toBe("code");
        expect(locationHeader.searchParams.get("scope")).toBe("read write");

        expect(response.headers.get("Set-Cookie")).toMatch(/jwt=[^;]+;/);
    });

    test("should have state in the URL", async () => {
        const formData = new FormData();

        formData.append("identifier", users[0]?.data.email ?? "");
        formData.append("password", passwords[0]);

        const response = await fakeRequest(
            `/api/auth/login?client_id=${application.data.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write&state=abc`,
            {
                method: "POST",
                body: formData,
            },
        );

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBeDefined();
        const locationHeader = new URL(
            response.headers.get("Location") ?? "",
            config.http.base_url,
        );

        expect(locationHeader.pathname).toBe("/oauth/consent");
        expect(locationHeader.searchParams.get("client_id")).toBe(
            application.data.clientId,
        );
        expect(locationHeader.searchParams.get("redirect_uri")).toBe(
            "https://example.com",
        );
        expect(locationHeader.searchParams.get("response_type")).toBe("code");
        expect(locationHeader.searchParams.get("scope")).toBe("read write");
        expect(locationHeader.searchParams.get("state")).toBe("abc");

        expect(response.headers.get("Set-Cookie")).toMatch(/jwt=[^;]+;/);
    });

    describe("should reject invalid credentials", () => {
        // Redirects to /oauth/authorize on invalid
        test("invalid email", async () => {
            const formData = new FormData();

            formData.append("identifier", "ababa@gmail.com");
            formData.append("password", "password");

            const response = await fakeRequest(
                `/api/auth/login?client_id=${application.data.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,

                {
                    method: "POST",
                    body: formData,
                },
            );

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBeDefined();
            const locationHeader = new URL(
                response.headers.get("Location") ?? "",
                "",
            );

            expect(locationHeader.pathname).toBe("/oauth/authorize");
            expect(locationHeader.searchParams.get("error")).toBe(
                "invalid_grant",
            );
            expect(locationHeader.searchParams.get("error_description")).toBe(
                "Invalid identifier or password",
            );

            expect(response.headers.get("Set-Cookie")).toBeNull();
        });

        test("invalid username", async () => {
            const formData = new FormData();

            formData.append("identifier", "ababa");
            formData.append("password", "password");

            const response = await fakeRequest(
                `/api/auth/login?client_id=${application.data.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
                {
                    method: "POST",
                    body: formData,
                },
            );

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBeDefined();
            const locationHeader = new URL(
                response.headers.get("Location") ?? "",
                "",
            );

            expect(locationHeader.pathname).toBe("/oauth/authorize");
            expect(locationHeader.searchParams.get("error")).toBe(
                "invalid_grant",
            );
            expect(locationHeader.searchParams.get("error_description")).toBe(
                "Invalid identifier or password",
            );

            expect(response.headers.get("Set-Cookie")).toBeNull();
        });

        test("invalid password", async () => {
            const formData = new FormData();

            formData.append("identifier", users[0]?.data.email ?? "");
            formData.append("password", "password");

            const response = await fakeRequest(
                `/api/auth/login?client_id=${application.data.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
                {
                    method: "POST",
                    body: formData,
                },
            );

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBeDefined();
            const locationHeader = new URL(
                response.headers.get("Location") ?? "",
                "",
            );

            expect(locationHeader.pathname).toBe("/oauth/authorize");
            expect(locationHeader.searchParams.get("error")).toBe(
                "invalid_grant",
            );
            expect(locationHeader.searchParams.get("error_description")).toBe(
                "Invalid identifier or password",
            );

            expect(response.headers.get("Set-Cookie")).toBeNull();
        });
    });
});
