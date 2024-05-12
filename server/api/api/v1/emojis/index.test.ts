import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { getTestUsers, sendTestRequest } from "~tests/utils";
import { meta } from "./index";

const { users, tokens, deleteUsers } = await getTestUsers(2);

// Make user 2 an admin
beforeAll(async () => {
    await users[1].update({ isAdmin: true });
});

afterAll(async () => {
    await deleteUsers();
});

describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    shortcode: "test",
                    element: "https://cdn.lysand.org/logo.webp",
                }),
            }),
        );

        expect(response.status).toBe(401);
    });

    test("should return 403 if not an admin", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                    "Content-Type": "application/json",
                },
                method: "POST",
                body: JSON.stringify({
                    shortcode: "test",
                    element: "https://cdn.lysand.org/logo.webp",
                }),
            }),
        );

        expect(response.status).toBe(403);
    });

    test("should upload a file and create an emoji", async () => {
        const formData = new FormData();
        formData.append("shortcode", "test");
        formData.append("element", Bun.file("tests/test-image.webp"));

        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
                body: formData,
            }),
        );

        expect(response.ok).toBe(true);
        const emoji = await response.json();
        expect(emoji.shortcode).toBe("test");
        expect(emoji.url).toContain("/media/proxy");
    });

    test("should try to upload a non-image", async () => {
        const formData = new FormData();
        formData.append("shortcode", "test");
        formData.append("element", new File(["test"], "test.txt"));

        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
                body: formData,
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should upload an emoji by url", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    shortcode: "test2",
                    element: "https://cdn.lysand.org/logo.webp",
                }),
            }),
        );

        expect(response.ok).toBe(true);
        const emoji = await response.json();
        expect(emoji.shortcode).toBe("test2");
        expect(emoji.url).toContain(
            Buffer.from("https://cdn.lysand.org/logo.webp").toString(
                "base64url",
            ),
        );
    });
});
