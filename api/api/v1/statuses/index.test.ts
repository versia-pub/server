import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Status } from "@versia/client/schemas";
import { Media, db } from "@versia/kit/db";
import { Emojis } from "@versia/kit/tables";
import { randomUUIDv7 } from "bun";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { config } from "~/config.ts";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(5);
let media: Media;

afterAll(async () => {
    await deleteUsers();
    await db.delete(Emojis).where(eq(Emojis.shortcode, "test"));
});

beforeAll(async () => {
    media = await Media.insert({
        id: randomUUIDv7(),
        content: {
            "image/png": {
                content: "https://example.com/test.png",
                remote: true,
            },
        },
    });

    await db.insert(Emojis).values({
        id: randomUUIDv7(),
        shortcode: "test",
        mediaId: media.id,
        visibleInPicker: true,
    });
});

describe("/api/v1/statuses", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.postStatus("Hello, world!");

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 422 is status is empty", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.postStatus("");

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should return 422 is status is too long", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.postStatus(
            "a".repeat(config.validation.notes.max_characters + 1),
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should return 422 is visibility is invalid", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.postStatus("Hello, world!", {
            visibility: "invalid" as z.infer<typeof Status>["visibility"],
        });

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should return 422 if scheduled_at is invalid", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok, raw } = await client.postStatus("Hello, world!", {
            scheduled_at: new Date(Date.now() - 1000),
        });

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
        expect(data).toMatchObject({
            error: expect.stringContaining(
                "must be at least 5 minutes in the future",
            ),
        });
    });

    test("should return 422 is in_reply_to_id is invalid", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.postStatus("Hello, world!", {
            in_reply_to_id: "invalid",
        });

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should return 422 is quote_id is invalid", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.postStatus("Hello, world!", {
            quote_id: "invalid",
        });

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should return 422 is media_ids is invalid", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.postStatus("Hello, world!", {
            media_ids: ["invalid"],
        });

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should create a post", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.postStatus("Hello, world!");

        expect(ok).toBe(true);
        expect(data).toMatchObject({
            content: "<p>Hello, world!</p>",
        });
    });

    test("should create a post with visibility", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.postStatus("Hello, world!", {
            visibility: "unlisted",
        });

        expect(ok).toBe(true);
        expect(data).toMatchObject({
            visibility: "unlisted",
            content: "<p>Hello, world!</p>",
        });
    });

    test("should create a post with a reply", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.postStatus("Hello, world!");

        expect(ok).toBe(true);

        const { data: data2, ok: ok2 } = await client.postStatus(
            "Hello, world again!",
            {
                in_reply_to_id: data.id,
            },
        );

        expect(ok2).toBe(true);
        expect(data2).toMatchObject({
            content: "<p>Hello, world again!</p>",
            in_reply_to_id: data.id,
        });
    });

    test("should create a post with a quote", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.postStatus("Hello, world!");

        expect(ok).toBe(true);

        const { data: data2, ok: ok2 } = await client.postStatus(
            "Hello, world again!",
            {
                quote_id: data.id,
            },
        );

        expect(ok2).toBe(true);
        expect(data2).toMatchObject({
            content: "<p>Hello, world again!</p>",
            quote: expect.objectContaining({
                id: data.id,
            }),
        });
    });

    test("should correctly parse emojis", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.postStatus("Hello, :test:!");

        expect(ok).toBe(true);

        expect((data as z.infer<typeof Status>).emojis).toBeArrayOfSize(1);
        expect((data as z.infer<typeof Status>).emojis[0]).toMatchObject({
            shortcode: "test",
            url: expect.stringContaining("/media/proxy/"),
        });
    });

    describe("mentions testing", () => {
        test("should correctly parse @mentions", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok } = await client.postStatus(
                `Hello, @${users[1].data.username}!`,
            );

            expect(ok).toBe(true);
            expect(data).toMatchObject({
                content: `<p>Hello, <a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${users[1].getUri()}">@${users[1].data.username}</a>!</p>`,
            });
            expect((data as z.infer<typeof Status>).mentions).toBeArrayOfSize(
                1,
            );
            expect((data as z.infer<typeof Status>).mentions[0]).toMatchObject({
                id: users[1].id,
                username: users[1].data.username,
                acct: users[1].data.username,
            });
        });

        test("should correctly parse @mentions@domain", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok } = await client.postStatus(
                `Hello, @${users[1].data.username}@${
                    config.http.base_url.host
                }!`,
            );

            expect(ok).toBe(true);
            expect(data).toMatchObject({
                content: `<p>Hello, <a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${users[1].getUri()}">@${users[1].data.username}</a>!</p>`,
            });
            expect((data as z.infer<typeof Status>).mentions).toBeArrayOfSize(
                1,
            );
            expect((data as z.infer<typeof Status>).mentions[0]).toMatchObject({
                id: users[1].id,
                username: users[1].data.username,
                acct: users[1].data.username,
            });
        });
    });

    describe("HTML injection testing", () => {
        test("should not allow HTML injection", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok } = await client.postStatus(
                "Hi! <script>alert('Hello, world!');</script>",
            );

            expect(ok).toBe(true);
            expect(data).toMatchObject({
                content:
                    "<p>Hi! &lt;script&gt;alert('Hello, world!');&lt;/script&gt;</p>",
            });
        });

        test("should not allow HTML injection in spoiler_text", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok } = await client.postStatus("Hello, world!", {
                spoiler_text: "uwu <script>alert('Hello, world!');</script>",
            });

            expect(ok).toBe(true);
            expect(data).toMatchObject({
                spoiler_text:
                    "uwu &#x3C;script&#x3E;alert(&#x27;Hello, world!&#x27;);&#x3C;/script&#x3E;",
            });
        });

        test("should rewrite all image and video src to go through proxy", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok } = await client.postStatus(
                "<img src='https://example.com/image.jpg'> <video src='https://example.com/video.mp4'> Test!",
            );

            expect(ok).toBe(true);
            // Proxy url is base_url/media/proxy/<base64url encoded url>
            expect(data).toMatchObject({
                content: `<p><img src="${config.http.base_url}media/proxy/${Buffer.from(
                    "https://example.com/image.jpg",
                ).toString("base64url")}"> <video src="${
                    config.http.base_url
                }media/proxy/${Buffer.from(
                    "https://example.com/video.mp4",
                ).toString("base64url")}"> Test!</p>`,
            });
        });
    });
});
