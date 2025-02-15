import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Status as ApiStatus } from "@versia/client/types";
import { Media, db } from "@versia/kit/db";
import { Emojis } from "@versia/kit/tables";
import { eq } from "drizzle-orm";
import { config } from "~/config.ts";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(5);
let media: Media;

afterAll(async () => {
    await deleteUsers();
    await db.delete(Emojis).where(eq(Emojis.shortcode, "test"));
});

beforeAll(async () => {
    media = await Media.insert({
        content: {
            "image/png": {
                content: "https://example.com/test.png",
                remote: true,
            },
        },
    });
    await db.insert(Emojis).values({
        shortcode: "test",
        mediaId: media.id,
        visibleInPicker: true,
    });
});

describe("/api/v1/statuses", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            body: new URLSearchParams({
                status: "Hello, world!",
            }),
        });

        expect(response.status).toBe(401);
    });

    test("should return 422 is status is empty", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams(),
        });

        expect(response.status).toBe(422);
    });

    test("should return 422 is status is too long", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "a".repeat(config.validation.notes.max_characters + 1),
                local_only: "true",
            }),
        });

        expect(response.status).toBe(422);
    });

    test("should return 422 is visibility is invalid", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, world!",
                visibility: "invalid",
                local_only: "true",
            }),
        });

        expect(response.status).toBe(422);
    });

    test("should return 422 if scheduled_at is invalid", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, world!",
                scheduled_at: "invalid",
                local_only: "true",
            }),
        });

        expect(response.status).toBe(422);
    });

    test("should return 422 is in_reply_to_id is invalid", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, world!",
                in_reply_to_id: "invalid",
                local_only: "true",
            }),
        });

        expect(response.status).toBe(422);
    });

    test("should return 422 is quote_id is invalid", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, world!",
                quote_id: "invalid",
                local_only: "true",
            }),
        });

        expect(response.status).toBe(422);
    });

    test("should return 422 is media_ids is invalid", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, world!",
                "media_ids[]": "invalid",
                local_only: "true",
            }),
        });

        expect(response.status).toBe(422);
    });

    test("should create a post", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, world!",
                local_only: "true",
            }),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );

        const object = (await response.json()) as ApiStatus;

        expect(object.content).toBe("<p>Hello, world!</p>");
    });

    test("should create a post with visibility", async () => {
        // This one uses JSON to test the interop
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                status: "Hello, world!",
                visibility: "unlisted",
                local_only: "true",
            }),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );

        const object = (await response.json()) as ApiStatus;

        expect(object.content).toBe("<p>Hello, world!</p>");
        expect(object.visibility).toBe("unlisted");
    });

    test("should create a post with a reply", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, world!",
                local_only: "true",
            }),
        });

        const object = (await response.json()) as ApiStatus;

        const response2 = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, world again!",
                in_reply_to_id: object.id,
                local_only: "true",
            }),
        });

        expect(response2.status).toBe(200);
        expect(response2.headers.get("content-type")).toContain(
            "application/json",
        );

        const object2 = (await response2.json()) as ApiStatus;

        expect(object2.content).toBe("<p>Hello, world again!</p>");
        expect(object2.in_reply_to_id).toBe(object.id);
    });

    test("should create a post with a quote", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, world!",
                local_only: "true",
            }),
        });

        const object = (await response.json()) as ApiStatus;

        const response2 = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, world again!",
                quote_id: object.id,
                local_only: "true",
            }),
        });

        expect(response2.status).toBe(200);
        expect(response2.headers.get("content-type")).toContain(
            "application/json",
        );

        const object2 = (await response2.json()) as ApiStatus;

        expect(object2.content).toBe("<p>Hello, world again!</p>");
        expect(object2.quote?.id).toBe(object.id);
    });

    test("should correctly parse emojis", async () => {
        const response = await fakeRequest("/api/v1/statuses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
            body: new URLSearchParams({
                status: "Hello, :test:!",
                local_only: "true",
            }),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );

        const object = (await response.json()) as ApiStatus;

        expect(object.emojis).toBeArrayOfSize(1);
        expect(object.emojis[0]).toMatchObject({
            shortcode: "test",
            url: expect.stringContaining("/media/proxy/"),
        });
    });

    describe("mentions testing", () => {
        test("should correctly parse @mentions", async () => {
            const response = await fakeRequest("/api/v1/statuses", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
                body: new URLSearchParams({
                    status: `Hello, @${users[1].data.username}!`,
                    local_only: "true",
                }),
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const object = (await response.json()) as ApiStatus;

            expect(object.content).toBe(
                `<p>Hello, <a class="u-url mention" rel="nofollow noopener noreferrer" target="_blank" href="${users[1].getUri()}">@${users[1].data.username}</a>!</p>`,
            );
            expect(object.mentions).toBeArrayOfSize(1);
            expect(object.mentions[0]).toMatchObject({
                id: users[1].id,
                username: users[1].data.username,
                acct: users[1].data.username,
            });
        });

        test("should correctly parse @mentions@domain", async () => {
            const response = await fakeRequest("/api/v1/statuses", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
                body: new URLSearchParams({
                    status: `Hello, @${users[1].data.username}@${
                        config.http.base_url.host
                    }!`,
                    local_only: "true",
                }),
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const object = (await response.json()) as ApiStatus;

            expect(object.mentions).toBeArrayOfSize(1);
            expect(object.mentions[0]).toMatchObject({
                id: users[1].id,
                username: users[1].data.username,
                acct: users[1].data.username,
            });
        });
    });

    describe("HTML injection testing", () => {
        test("should not allow HTML injection", async () => {
            const response = await fakeRequest("/api/v1/statuses", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hi! <script>alert('Hello, world!');</script>",
                    local_only: "true",
                }),
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const object = (await response.json()) as ApiStatus;

            expect(object.content).toBe(
                "<p>Hi! &lt;script&gt;alert('Hello, world!');&lt;/script&gt;</p>",
            );
        });

        test("should not allow HTML injection in spoiler_text", async () => {
            const response = await fakeRequest("/api/v1/statuses", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world!",
                    spoiler_text:
                        "uwu <script>alert('Hello, world!');</script>",
                    local_only: "true",
                }),
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const object = (await response.json()) as ApiStatus;

            expect(object.spoiler_text).toBe(
                "uwu &#x3C;script&#x3E;alert(&#x27;Hello, world!&#x27;);&#x3C;/script&#x3E;",
            );
        });

        test("should rewrite all image and video src to go through proxy", async () => {
            const response = await fakeRequest("/api/v1/statuses", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
                body: new URLSearchParams({
                    status: "<img src='https://example.com/image.jpg'> <video src='https://example.com/video.mp4'> Test!",
                    local_only: "true",
                }),
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const object = (await response.json()) as ApiStatus;
            // Proxy url is base_url/media/proxy/<base64url encoded url>
            expect(object.content).toBe(
                `<p><img src="${config.http.base_url}media/proxy/${Buffer.from(
                    "https://example.com/image.jpg",
                ).toString("base64url")}"> <video src="${
                    config.http.base_url
                }media/proxy/${Buffer.from(
                    "https://example.com/video.mp4",
                ).toString("base64url")}"> Test!</p>`,
            );
        });
    });
});
