import { afterAll, describe, expect, test } from "bun:test";
import { randomString } from "@/math";
import { Application } from "~/classes/database/application.ts";
import { config } from "~/packages/config-manager";
import { fakeRequest, getTestUsers } from "~/tests/utils";
import { meta } from "./index.ts";

const { users, deleteUsers, passwords } = await getTestUsers(1);
const token = randomString(32, "hex");
const newPassword = randomString(16, "hex");

// Create application
const application = await Application.insert({
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

// /api/auth/reset
describe(meta.route, () => {
    test("should login with normal password", async () => {
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
    });

    test("should reset password and refuse login with old password", async () => {
        await users[0]?.update({
            passwordResetToken: token,
        });

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

        expect(locationHeader.pathname).toBe("/oauth/reset");
        expect(locationHeader.searchParams.get("token")).toBe(token);
    });

    test("should reset password and login with new password", async () => {
        const formData = new FormData();

        formData.append("token", token);
        formData.append("password", newPassword);
        formData.append("password2", newPassword);

        const response = await fakeRequest("/api/auth/reset", {
            method: "POST",
            body: formData,
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBeDefined();

        const loginFormData = new FormData();

        loginFormData.append("identifier", users[0]?.data.username ?? "");
        loginFormData.append("password", newPassword);

        const loginResponse = await fakeRequest(
            `/api/auth/login?client_id=${application.data.clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
            {
                method: "POST",
                body: loginFormData,
            },
        );

        expect(loginResponse.status).toBe(302);
        expect(loginResponse.headers.get("location")).toBeDefined();
        const locationHeader = new URL(
            loginResponse.headers.get("Location") ?? "",
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

        expect(loginResponse.headers.get("Set-Cookie")).toMatch(/jwt=[^;]+;/);
    });
});
