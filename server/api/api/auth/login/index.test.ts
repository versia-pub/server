import { afterAll, describe, expect, test } from "bun:test";
import { randomString } from "@/math";
import { eq } from "drizzle-orm";
import { db } from "~/drizzle/db";
import { Applications } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./index";

const { users, deleteUsers, passwords } = await getTestUsers(1);

// Create application
const application = (
    await db
        .insert(Applications)
        .values({
            name: "Test Application",
            clientId: randomString(32, "hex"),
            secret: "test",
            redirectUri: "https://example.com",
            scopes: "read write",
        })
        .returning()
)[0];

afterAll(async () => {
    await deleteUsers();
    await db.delete(Applications).where(eq(Applications.id, application.id));
});

// /api/auth/login
describe(meta.route, () => {
    test("should get a JWT with email", async () => {
        const formData = new FormData();

        formData.append("identifier", users[0]?.data.email ?? "");
        formData.append("password", passwords[0]);

        const response = await sendTestRequest(
            new Request(
                new URL(
                    `/api/auth/login?client_id=${application.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    body: formData,
                },
            ),
        );

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBeDefined();
        const locationHeader = new URL(
            response.headers.get("Location") ?? "",
            "",
        );

        expect(locationHeader.pathname).toBe("/oauth/consent");
        expect(locationHeader.searchParams.get("client_id")).toBe(
            application.clientId,
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

        const response = await sendTestRequest(
            new Request(
                new URL(
                    `/api/auth/login?client_id=${application.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    body: formData,
                },
            ),
        );

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBeDefined();
        const locationHeader = new URL(
            response.headers.get("Location") ?? "",
            "",
        );

        expect(locationHeader.pathname).toBe("/oauth/consent");
        expect(locationHeader.searchParams.get("client_id")).toBe(
            application.clientId,
        );
        expect(locationHeader.searchParams.get("redirect_uri")).toBe(
            "https://example.com",
        );
        expect(locationHeader.searchParams.get("response_type")).toBe("code");
        expect(locationHeader.searchParams.get("scope")).toBe("read write");

        expect(response.headers.get("Set-Cookie")).toMatch(/jwt=[^;]+;/);
    });

    describe("should reject invalid credentials", () => {
        // Redirects to /oauth/authorize on invalid
        test("invalid email", async () => {
            const formData = new FormData();

            formData.append("identifier", "ababa@gmail.com");
            formData.append("password", "password");

            const response = await sendTestRequest(
                new Request(
                    new URL(
                        `/api/auth/login?client_id=${application.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
                        config.http.base_url,
                    ),
                    {
                        method: "POST",
                        body: formData,
                    },
                ),
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

            const response = await sendTestRequest(
                new Request(
                    new URL(
                        `/api/auth/login?client_id=${application.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
                        config.http.base_url,
                    ),
                    {
                        method: "POST",
                        body: formData,
                    },
                ),
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

            const response = await sendTestRequest(
                new Request(
                    new URL(
                        `/api/auth/login?client_id=${application.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
                        config.http.base_url,
                    ),
                    {
                        method: "POST",
                        body: formData,
                    },
                ),
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
