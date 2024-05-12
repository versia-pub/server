import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { getTestUsers, sendTestRequest } from "~tests/utils";
import { meta } from "./index";

const { users, tokens, deleteUsers } = await getTestUsers(2);
let id = "";

// Make user 2 an admin
beforeAll(async () => {
    await users[1].update({ isAdmin: true });

    // Create an emoji
    const response = await sendTestRequest(
        new Request(new URL("/api/v1/emojis", config.http.base_url), {
            headers: {
                Authorization: `Bearer ${tokens[1].accessToken}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
                shortcode: "test",
                element: "https://cdn.lysand.org/logo.webp",
            }),
        }),
    );

    expect(response.ok).toBe(true);
    const emoji = await response.json();
    id = emoji.id;
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/emojis/:id (PATCH, DELETE, GET)
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(meta.route.replace(":id", id), config.http.base_url),
                {
                    method: "GET",
                },
            ),
        );

        expect(response.status).toBe(401);
    });

    test("should return 404 if emoji does not exist", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(
                        ":id",
                        "00000000-0000-0000-0000-000000000000",
                    ),
                    config.http.base_url,
                ),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[1].accessToken}`,
                    },
                    method: "GET",
                },
            ),
        );

        expect(response.status).toBe(404);
    });

    test("should return 403 if not an admin", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(meta.route.replace(":id", id), config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                    method: "GET",
                },
            ),
        );

        expect(response.status).toBe(403);
    });

    test("should return the emoji", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(meta.route.replace(":id", id), config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[1].accessToken}`,
                    },
                    method: "GET",
                },
            ),
        );

        expect(response.ok).toBe(true);
        const emoji = await response.json();
        expect(emoji.shortcode).toBe("test");
    });

    test("should update the emoji", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(meta.route.replace(":id", id), config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[1].accessToken}`,
                        "Content-Type": "application/json",
                    },
                    method: "PATCH",
                    body: JSON.stringify({
                        shortcode: "test2",
                    }),
                },
            ),
        );

        expect(response.ok).toBe(true);
        const emoji = await response.json();
        expect(emoji.shortcode).toBe("test2");
    });

    test("should update the emoji with another url, but keep the shortcode", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(meta.route.replace(":id", id), config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[1].accessToken}`,
                        "Content-Type": "application/json",
                    },
                    method: "PATCH",
                    body: JSON.stringify({
                        element:
                            "https://avatars.githubusercontent.com/u/30842467?v=4",
                    }),
                },
            ),
        );

        expect(response.ok).toBe(true);
        const emoji = await response.json();
        expect(emoji.shortcode).toBe("test2");
    });

    test("should delete the emoji", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(meta.route.replace(":id", id), config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[1].accessToken}`,
                    },
                    method: "DELETE",
                },
            ),
        );

        expect(response.status).toBe(204);
    });
});
