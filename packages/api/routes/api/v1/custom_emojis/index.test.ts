import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@versia-server/kit/db";
import { Emojis } from "@versia-server/kit/tables";
import { generateClient, getTestUsers } from "@versia-server/tests";
import { inArray } from "drizzle-orm";

const { users, deleteUsers } = await getTestUsers(2);

// Make user 2 an admin
beforeAll(async () => {
    await users[1].update({ isAdmin: true });

    // Upload one emoji as admin, then one as each user
    await using client1 = await generateClient(users[1]);

    const { ok } = await client1.uploadEmoji(
        "test1",
        new URL("https://cdn.versia.social/logo.webp"),
        {
            global: true,
        },
    );

    expect(ok).toBe(true);

    await using client0 = await generateClient(users[0]);

    const { ok: ok2 } = await client0.uploadEmoji(
        "test2",
        new URL("https://cdn.versia.social/logo.webp"),
    );

    expect(ok2).toBe(true);

    const { ok: ok3 } = await client1.uploadEmoji(
        "test3",
        new URL("https://cdn.versia.social/logo.webp"),
    );

    expect(ok3).toBe(true);
});

afterAll(async () => {
    await deleteUsers();

    await db
        .delete(Emojis)
        .where(inArray(Emojis.shortcode, ["test1", "test2", "test3"]));
});

describe("/api/v1/custom_emojis", () => {
    test("should return all global emojis", async () => {
        await using client = await generateClient(users[1]);

        const { data, ok } = await client.getInstanceCustomEmojis();

        expect(ok).toBe(true);
        // Should contain test1 and test2, but not test2
        expect(data).toContainEqual(
            expect.objectContaining({
                shortcode: "test1",
            }),
        );
        expect(data).not.toContainEqual(
            expect.objectContaining({
                shortcode: "test2",
            }),
        );
        expect(data).toContainEqual(
            expect.objectContaining({
                shortcode: "test3",
            }),
        );
    });

    test("should return all user emojis", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getInstanceCustomEmojis();

        expect(ok).toBe(true);
        // Should contain test1 and test2, but not test3
        expect(data).toContainEqual(
            expect.objectContaining({
                shortcode: "test1",
            }),
        );
        expect(data).toContainEqual(
            expect.objectContaining({
                shortcode: "test2",
            }),
        );
        expect(data).not.toContainEqual(
            expect.objectContaining({
                shortcode: "test3",
            }),
        );
    });

    test("should return all global emojis when signed out", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getInstanceCustomEmojis();

        expect(ok).toBe(true);

        // Should contain test1, but not test2 or test3
        expect(data).toContainEqual(
            expect.objectContaining({
                shortcode: "test1",
            }),
        );
        expect(data).not.toContainEqual(
            expect.objectContaining({
                shortcode: "test2",
            }),
        );
        expect(data).not.toContainEqual(
            expect.objectContaining({
                shortcode: "test3",
            }),
        );
    });
});
