import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@versia/kit/db";
import { Emojis } from "@versia/kit/tables";
import { inArray } from "drizzle-orm";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);
let id = "";

// Make user 2 an admin
beforeAll(async () => {
    await users[1].update({ isAdmin: true });

    // Create an emoji
    await using client = await generateClient(users[1]);
    const { data, ok } = await client.uploadEmoji(
        "test",
        new URL("https://cdn.versia.social/logo.webp"),
    );

    expect(ok).toBe(true);
    id = data.id;
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
        await using client = await generateClient();

        const { ok, raw } = await client.getEmoji(id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if emoji does not exist", async () => {
        await using client = await generateClient(users[1]);

        const { ok, raw } = await client.getEmoji(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should not work if the user is trying to update an emoji they don't own", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.updateEmoji(id, {
            shortcode: "test2",
        });

        expect(ok).toBe(false);
        expect(raw.status).toBe(403);
    });

    test("should return the emoji", async () => {
        await using client = await generateClient(users[1]);

        const { data, ok } = await client.getEmoji(id);

        expect(ok).toBe(true);
        expect(data.shortcode).toBe("test");
    });

    test("should update the emoji", async () => {
        await using client = await generateClient(users[1]);

        const { data, ok } = await client.updateEmoji(id, {
            shortcode: "test2",
        });

        expect(ok).toBe(true);
        expect(data.shortcode).toBe("test2");
    });

    test("should update the emoji with another url, but keep the shortcode", async () => {
        await using client = await generateClient(users[1]);

        const { data, ok } = await client.updateEmoji(id, {
            image: new URL(
                "https://avatars.githubusercontent.com/u/30842467?v=4",
            ),
        });

        expect(ok).toBe(true);
        expect(data.shortcode).toBe("test2");
        expect(data.url).toContain("/media/proxy/");
    });

    test("should update the emoji to be non-global", async () => {
        await using client = await generateClient(users[1]);

        const { data, ok } = await client.updateEmoji(id, {
            global: false,
        });

        expect(ok).toBe(true);
        expect(data.global).toBe(false);

        // Check if the other user can see it
        await using client2 = await generateClient(users[0]);

        const { data: data2, ok: ok2 } =
            await client2.getInstanceCustomEmojis();

        expect(ok2).toBe(true);
        expect(data2).not.toContainEqual(expect.objectContaining({ id }));
    });

    test("should delete the emoji", async () => {
        await using client = await generateClient(users[1]);

        const { ok } = await client.deleteEmoji(id);

        expect(ok).toBe(true);
    });
});
