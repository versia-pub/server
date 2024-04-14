import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { eq } from "drizzle-orm";
import { db } from "~drizzle/db";
import { emoji } from "~drizzle/schema";
import type { Emoji as APIEmoji } from "~types/mastodon/emoji";
import type { Instance as APIInstance } from "~types/mastodon/instance";
import { getTestUsers, sendTestRequest, wrapRelativeUrl } from "./utils";

const base_url = config.http.base_url;

const { tokens, deleteUsers } = await getTestUsers(1);

describe("API Tests", () => {
    afterAll(async () => {
        await deleteUsers();
    });

    describe("GET /api/v1/instance", () => {
        test("should return an APIInstance object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(`${base_url}/api/v1/instance`, base_url),
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const instance = (await response.json()) as APIInstance;

            expect(instance.uri).toBe(config.http.base_url);
            expect(instance.title).toBeDefined();
            expect(instance.description).toBeDefined();
            expect(instance.email).toBeDefined();
            expect(instance.version).toBeDefined();
            expect(instance.urls).toBeDefined();
            expect(instance.stats).toBeDefined();
            expect(instance.thumbnail).toBeDefined();
            expect(instance.languages).toBeDefined();
            // Not implemented yet
            // expect(instance.contact_account).toBeDefined();
            expect(instance.rules).toBeDefined();
            expect(instance.approval_required).toBeDefined();
        });
    });

    describe("GET /api/v1/custom_emojis", () => {
        beforeAll(async () => {
            await db.insert(emoji).values({
                shortcode: "test",
                url: "https://example.com/test.png",
                contentType: "image/png",
                visibleInPicker: true,
            });
        });

        test("should return an array of at least one custom emoji", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `${base_url}/api/v1/custom_emojis`,
                        base_url,
                    ),
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${tokens[0].accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const emojis = (await response.json()) as APIEmoji[];

            expect(emojis.length).toBeGreaterThan(0);
            expect(emojis[0].shortcode).toBeString();
            expect(emojis[0].url).toBeString();
        });

        afterAll(async () => {
            await db.delete(emoji).where(eq(emoji.shortcode, "test"));
        });
    });
});
