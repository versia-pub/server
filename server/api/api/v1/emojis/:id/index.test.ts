import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { inArray } from "drizzle-orm";
import { db } from "~drizzle/db";
import { Emojis } from "~drizzle/schema";
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
                global: true,
            }),
        }),
    );

    expect(response.ok).toBe(true);
    const emoji = await response.json();
    id = emoji.id;
});

afterAll(async () => {
    await deleteUsers();

    await db
        .delete(Emojis)
        .where(inArray(Emojis.shortcode, ["test", "test2", "test3", "test4"]));
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

    test("should not work if the user is trying to update an emoji they don't own", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(meta.route.replace(":id", id), config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                        "Content-Type": "application/json",
                    },
                    method: "PATCH",
                    body: JSON.stringify({
                        shortcode: "test2",
                    }),
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

    test("should update the emoji to be non-global", async () => {
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
                        global: false,
                    }),
                },
            ),
        );

        expect(response.ok).toBe(true);

        // Check if the other user can see it
        const response2 = await sendTestRequest(
            new Request(
                new URL("/api/v1/custom_emojis", config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                    method: "GET",
                },
            ),
        );

        expect(response2.ok).toBe(true);
        const emojis = await response2.json();
        expect(emojis).not.toContainEqual(expect.objectContaining({ id: id }));
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
