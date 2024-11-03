import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@versia/kit/db";
import { Emojis } from "@versia/kit/tables";
import { inArray } from "drizzle-orm";
import sharp from "sharp";
import { fakeRequest, getTestUsers } from "~/tests/utils";
import { meta } from "./index.ts";

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

describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                shortcode: "test",
                element: "https://cdn.versia.social/logo.webp",
            }),
        });

        expect(response.status).toBe(401);
    });

    describe("Admin tests", () => {
        test("should upload a file and create an emoji", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test1");
            formData.append("element", await createImage("test.png"));
            formData.append("global", "true");

            const response = await fakeRequest(meta.route, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].data.accessToken}`,
                },
                body: formData,
            });

            expect(response.ok).toBe(true);
            const emoji = await response.json();
            expect(emoji.shortcode).toBe("test1");
            expect(emoji.url).toContain("/media/proxy");
        });

        test("should try to upload a non-image", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test2");
            formData.append("element", new File(["test"], "test.txt"));

            const response = await fakeRequest(meta.route, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].data.accessToken}`,
                },
                body: formData,
            });

            expect(response.status).toBe(422);
        });

        test("should upload an emoji by url", async () => {
            const response = await fakeRequest(meta.route, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].data.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    shortcode: "test3",
                    element: "https://cdn.versia.social/logo.webp",
                }),
            });

            expect(response.ok).toBe(true);
            const emoji = await response.json();
            expect(emoji.shortcode).toBe("test3");
            expect(emoji.url).toContain("/media/proxy/");
        });

        test("should fail when uploading an already existing emoji", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test1");
            formData.append("element", await createImage("test-image.png"));

            const response = await fakeRequest(meta.route, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].data.accessToken}`,
                },
                body: formData,
            });

            expect(response.status).toBe(422);
        });
    });

    describe("User tests", () => {
        test("should upload a file and create an emoji", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test4");
            formData.append("element", await createImage("test-image.png"));

            const response = await fakeRequest(meta.route, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
                body: formData,
            });

            expect(response.ok).toBe(true);
            const emoji = await response.json();
            expect(emoji.shortcode).toBe("test4");
            expect(emoji.url).toContain("/media/proxy/");
        });

        test("should fail when uploading an already existing global emoji", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test1");
            formData.append("element", await createImage("test-image.png"));

            const response = await fakeRequest(meta.route, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
                body: formData,
            });

            expect(response.status).toBe(422);
        });

        test("should create an emoji as another user with the same shortcode", async () => {
            const formData = new FormData();
            formData.append("shortcode", "test4");
            formData.append("element", await createImage("test-image.png"));

            const response = await fakeRequest(meta.route, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[2].data.accessToken}`,
                },
                body: formData,
            });

            expect(response.ok).toBe(true);
            const emoji = await response.json();
            expect(emoji.shortcode).toBe("test4");
            expect(emoji.url).toContain("/media/proxy/");
        });
    });
});
