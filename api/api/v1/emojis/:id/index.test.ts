import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@versia/kit/db";
import { Emojis } from "@versia/kit/tables";
import { inArray } from "drizzle-orm";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(2);
let id = "";

// Make user 2 an admin
beforeAll(async () => {
    await users[1].update({ isAdmin: true });

    // Create an emoji
    const response = await fakeRequest("/api/v1/emojis", {
        headers: {
            Authorization: `Bearer ${tokens[1].data.accessToken}`,
            "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
            shortcode: "test",
            element: "https://cdn.versia.social/logo.webp",
            global: true,
        }),
    });

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
describe("/api/v1/emojis/:id", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(`/api/v1/emojis/${id}`, {
            method: "GET",
        });

        expect(response.status).toBe(401);
    });

    test("should return 404 if emoji does not exist", async () => {
        const response = await fakeRequest(
            "/api/v1/emojis/00000000-0000-0000-0000-000000000000",
            {
                headers: {
                    Authorization: `Bearer ${tokens[1].data.accessToken}`,
                },
                method: "GET",
            },
        );

        expect(response.status).toBe(404);
    });

    test("should not work if the user is trying to update an emoji they don't own", async () => {
        const response = await fakeRequest(`/api/v1/emojis/${id}`, {
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
            method: "PATCH",
            body: JSON.stringify({
                shortcode: "test2",
            }),
        });

        expect(response.status).toBe(403);
    });

    test("should return the emoji", async () => {
        const response = await fakeRequest(`/api/v1/emojis/${id}`, {
            headers: {
                Authorization: `Bearer ${tokens[1].data.accessToken}`,
            },
            method: "GET",
        });

        expect(response.ok).toBe(true);
        const emoji = await response.json();
        expect(emoji.shortcode).toBe("test");
    });

    test("should update the emoji", async () => {
        const response = await fakeRequest(`/api/v1/emojis/${id}`, {
            headers: {
                Authorization: `Bearer ${tokens[1].data.accessToken}`,
                "Content-Type": "application/json",
            },
            method: "PATCH",
            body: JSON.stringify({
                shortcode: "test2",
            }),
        });

        expect(response.ok).toBe(true);
        const emoji = await response.json();
        expect(emoji.shortcode).toBe("test2");
    });

    test("should update the emoji with another url, but keep the shortcode", async () => {
        const response = await fakeRequest(`/api/v1/emojis/${id}`, {
            headers: {
                Authorization: `Bearer ${tokens[1].data.accessToken}`,
                "Content-Type": "application/json",
            },
            method: "PATCH",
            body: JSON.stringify({
                element: "https://avatars.githubusercontent.com/u/30842467?v=4",
            }),
        });

        expect(response.ok).toBe(true);
        const emoji = await response.json();
        expect(emoji.shortcode).toBe("test2");
    });

    test("should update the emoji to be non-global", async () => {
        const response = await fakeRequest(`/api/v1/emojis/${id}`, {
            headers: {
                Authorization: `Bearer ${tokens[1].data.accessToken}`,
                "Content-Type": "application/json",
            },
            method: "PATCH",
            body: JSON.stringify({
                global: false,
            }),
        });

        expect(response.ok).toBe(true);

        // Check if the other user can see it
        const response2 = await fakeRequest("/api/v1/custom_emojis", {
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            method: "GET",
        });

        expect(response2.ok).toBe(true);
        const emojis = await response2.json();
        expect(emojis).not.toContainEqual(expect.objectContaining({ id }));
    });

    test("should delete the emoji", async () => {
        const response = await fakeRequest(`/api/v1/emojis/${id}`, {
            headers: {
                Authorization: `Bearer ${tokens[1].data.accessToken}`,
            },
            method: "DELETE",
        });

        expect(response.status).toBe(204);
    });
});
