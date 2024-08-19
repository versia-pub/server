import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import { db } from "~/drizzle/db";
import { Emojis } from "~/drizzle/schema";
import { config } from "~/packages/config-manager/index";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./index";

const { users, tokens, deleteUsers } = await getTestUsers(2);

// Make user 2 an admin
beforeAll(async () => {
    await users[1].update({ isAdmin: true });

    // Upload one emoji as admin, then one as each user
    const response = await sendTestRequest(
        new Request(new URL("/api/v1/emojis", config.http.base_url), {
            headers: {
                Authorization: `Bearer ${tokens[1].accessToken}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
                shortcode: "test1",
                element: "https://cdn.lysand.org/logo.webp",
                global: true,
            }),
        }),
    );

    expect(response.status).toBe(200);

    await sendTestRequest(
        new Request(new URL("/api/v1/emojis", config.http.base_url), {
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
                shortcode: "test2",
                element: "https://cdn.lysand.org/logo.webp",
            }),
        }),
    );

    await sendTestRequest(
        new Request(new URL("/api/v1/emojis", config.http.base_url), {
            headers: {
                Authorization: `Bearer ${tokens[1].accessToken}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
                shortcode: "test3",
                element: "https://cdn.lysand.org/logo.webp",
            }),
        }),
    );
});

afterAll(async () => {
    await deleteUsers();

    await db
        .delete(Emojis)
        .where(inArray(Emojis.shortcode, ["test1", "test2", "test3"]));
});

describe(meta.route, () => {
    test("should return all global emojis", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
            }),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const emojis = await response.json();

        // Should contain test1 and test2, but not test2
        expect(emojis).toContainEqual(
            expect.objectContaining({
                shortcode: "test1",
            }),
        );
        expect(emojis).not.toContainEqual(
            expect.objectContaining({
                shortcode: "test2",
            }),
        );
        expect(emojis).toContainEqual(
            expect.objectContaining({
                shortcode: "test3",
            }),
        );
    });

    test("should return all user emojis", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            }),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const emojis = await response.json();

        // Should contain test1 and test2, but not test3
        expect(emojis).toContainEqual(
            expect.objectContaining({
                shortcode: "test1",
            }),
        );
        expect(emojis).toContainEqual(
            expect.objectContaining({
                shortcode: "test2",
            }),
        );
        expect(emojis).not.toContainEqual(
            expect.objectContaining({
                shortcode: "test3",
            }),
        );
    });

    test("should return all global emojis when signed out", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url)),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const emojis = await response.json();

        // Should contain test1, but not test2 or test3
        expect(emojis).toContainEqual(
            expect.objectContaining({
                shortcode: "test1",
            }),
        );
        expect(emojis).not.toContainEqual(
            expect.objectContaining({
                shortcode: "test2",
            }),
        );
        expect(emojis).not.toContainEqual(
            expect.objectContaining({
                shortcode: "test3",
            }),
        );
    });
});
