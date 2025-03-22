import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@versia/kit/db";
import { Emojis } from "@versia/kit/tables";
import { inArray } from "drizzle-orm";
import sharp from "sharp";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(3);

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

const createImage = async (name: string): Promise<File> => {
    const inputBuffer = await sharp({
        create: {
            width: 100,
            height: 100,
            channels: 3,
            background: { r: 255, g: 0, b: 0 },
        },
    })
        .png()
        .toBuffer();

    return new File([inputBuffer], name, {
        type: "image/png",
    });
};

describe("/api/v1/emojis", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.uploadEmoji(
            "test",
            new URL("https://cdn.versia.social/logo.webp"),
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    describe("Admin tests", () => {
        test("should upload a file and create an emoji", async () => {
            await using client = await generateClient(users[1]);

            const { data, ok } = await client.uploadEmoji(
                "test1",
                await createImage("test.png"),
                {
                    global: true,
                },
            );

            expect(ok).toBe(true);
            expect(data.shortcode).toBe("test1");
            expect(data.url).toContain("/media/proxy");
        });

        test("should try to upload a non-image", async () => {
            await using client = await generateClient(users[1]);

            const { ok, raw } = await client.uploadEmoji(
                "test2",
                new File(["test"], "test.txt"),
            );

            expect(ok).toBe(false);
            expect(raw.status).toBe(422);
        });

        test("should upload an emoji by url", async () => {
            await using client = await generateClient(users[1]);

            const { data, ok } = await client.uploadEmoji(
                "test3",
                new URL("https://cdn.versia.social/logo.webp"),
            );

            expect(ok).toBe(true);
            expect(data.shortcode).toBe("test3");
            expect(data.url).toContain("/media/proxy");
        });

        test("should fail when uploading an already existing emoji", async () => {
            await using client = await generateClient(users[1]);

            const { ok, raw } = await client.uploadEmoji(
                "test1",
                await createImage("test-image.png"),
            );

            expect(ok).toBe(false);
            expect(raw.status).toBe(422);
        });
    });

    describe("User tests", () => {
        test("should upload a file and create an emoji", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok } = await client.uploadEmoji(
                "test4",
                await createImage("test-image.png"),
            );

            expect(ok).toBe(true);
            expect(data.shortcode).toBe("test4");
            expect(data.url).toContain("/media/proxy");
        });

        test("should fail when uploading an already existing global emoji", async () => {
            await using client = await generateClient(users[0]);

            const { ok, raw } = await client.uploadEmoji(
                "test1",
                await createImage("test-image.png"),
            );

            expect(ok).toBe(false);
            expect(raw.status).toBe(422);
        });

        test("should create an emoji as another user with the same shortcode", async () => {
            await using client = await generateClient(users[2]);

            const { data, ok } = await client.uploadEmoji(
                "test4",
                await createImage("test-image.png"),
            );

            expect(ok).toBe(true);
            expect(data.shortcode).toBe("test4");
            expect(data.url).toContain("/media/proxy/");
        });
    });
});
