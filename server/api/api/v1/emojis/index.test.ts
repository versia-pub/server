import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { inArray } from "drizzle-orm";
import { db } from "~/drizzle/db";
import { Emojis } from "~/drizzle/schema";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./index";

const { users, tokens, deleteUsers } = await getTestUsers(3);

// Make user 2 an admin
beforeAll(async () => {
    await users[1].update({ isAdmin: true });
});

afterAll(async () => {
    await deleteUsers();

    await db
        .delete(Emojis)
        .where(inArray(Emojis.shortcode, ["test1", "test2", "test3", "test4"]));
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

    describe("Admin tests", () => {
        test("should upload a file and create an emoji", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test1");
            formData.append("element", Bun.file("tests/test-image.webp"));
            formData.append("global", "true");

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
            expect(emoji.shortcode).toBe("test1");
            expect(emoji.url).toContain("/media/proxy");
        });

        test("should try to upload a non-image", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test2");
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
                        shortcode: "test3",
                        element: "https://cdn.lysand.org/logo.webp",
                    }),
                }),
            );

            expect(response.ok).toBe(true);
            const emoji = await response.json();
            expect(emoji.shortcode).toBe("test3");
            expect(emoji.url).toContain("/media/proxy/");
        });

        test("should fail when uploading an already existing emoji", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test1");
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

            expect(response.status).toBe(422);
        });
    });

    describe("User tests", () => {
        test("should upload a file and create an emoji", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test4");
            formData.append("element", Bun.file("tests/test-image.webp"));

            const response = await sendTestRequest(
                new Request(new URL(meta.route, config.http.base_url), {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                    body: formData,
                }),
            );

            expect(response.ok).toBe(true);
            const emoji = await response.json();
            expect(emoji.shortcode).toBe("test4");
            expect(emoji.url).toContain("/media/proxy/");
        });

        test("should fail when uploading an already existing global emoji", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test1");
            formData.append("element", Bun.file("tests/test-image.webp"));

            const response = await sendTestRequest(
                new Request(new URL(meta.route, config.http.base_url), {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                    body: formData,
                }),
            );

            expect(response.status).toBe(422);
        });

        test("should create an emoji as another user with the same shortcode", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test4");
            formData.append("element", Bun.file("tests/test-image.webp"));

            const response = await sendTestRequest(
                new Request(new URL(meta.route, config.http.base_url), {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[2].accessToken}`,
                    },
                    body: formData,
                }),
            );

            expect(response.ok).toBe(true);
            const emoji = await response.json();
            expect(emoji.shortcode).toBe("test4");
            expect(emoji.url).toContain("/media/proxy/");
        });
    });
});
