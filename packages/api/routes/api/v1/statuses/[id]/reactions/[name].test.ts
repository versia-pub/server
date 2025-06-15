import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Emoji, Media } from "@versia/kit/db";
import {
    generateClient,
    getTestStatuses,
    getTestUsers,
} from "@versia-server/tests";
import { randomUUIDv7 } from "bun";

const { users, deleteUsers } = await getTestUsers(3);
const timeline = (await getTestStatuses(2, users[0])).toReversed();
let emojiMedia: Media;
let customEmoji: Emoji;

beforeAll(async () => {
    emojiMedia = await Media.insert({
        id: randomUUIDv7(),
        content: {
            "image/png": {
                content: "https://example.com/image.png",
                remote: true,
            },
        },
    });

    customEmoji = await Emoji.insert({
        id: randomUUIDv7(),
        shortcode: "test_emoji",
        visibleInPicker: true,
        mediaId: emojiMedia.id,
    });
});

afterAll(async () => {
    await deleteUsers();
    await customEmoji.delete();
    await emojiMedia.delete();
});

describe("/api/v1/statuses/:id/reactions/:name", () => {
    describe("PUT (add reaction)", () => {
        test("should return 401 if not authenticated", async () => {
            await using client = await generateClient();

            const { ok, raw } = await client.createEmojiReaction(
                timeline[0].id,
                "👍",
            );

            expect(ok).toBe(false);
            expect(raw.status).toBe(401);
        });

        test("should add unicode emoji reaction", async () => {
            await using client = await generateClient(users[1]);

            const { data, ok } = await client.createEmojiReaction(
                timeline[0].id,
                "👍",
            );

            expect(ok).toBe(true);
            expect(data.reactions).toContainEqual(
                expect.objectContaining({
                    name: "👍",
                    count: 1,
                    me: true,
                }),
            );
        });

        test("should add custom emoji reaction", async () => {
            await using client = await generateClient(users[1]);

            const { data, ok } = await client.createEmojiReaction(
                timeline[0].id,
                `:${customEmoji.data.shortcode}:`,
            );

            expect(ok).toBe(true);
            expect(data.reactions).toContainEqual(
                expect.objectContaining({
                    name: `:${customEmoji.data.shortcode}:`,
                    count: 1,
                    me: true,
                }),
            );
            expect(data.emojis).toContainEqual(
                expect.objectContaining({
                    shortcode: customEmoji.data.shortcode,
                }),
            );
        });

        test("should add multiple different reactions", async () => {
            await using client1 = await generateClient(users[1]);
            await using client2 = await generateClient(users[2]);

            await client1.createEmojiReaction(timeline[1].id, "❤️");
            const { data, ok } = await client2.createEmojiReaction(
                timeline[1].id,
                "😂",
            );

            expect(ok).toBe(true);
            expect(data.reactions).toHaveLength(2);
            expect(data.reactions).toContainEqual(
                expect.objectContaining({
                    name: "❤️",
                    count: 1,
                    me: false,
                    remote: false,
                }),
            );
            expect(data.reactions).toContainEqual(
                expect.objectContaining({
                    name: "😂",
                    count: 1,
                    me: true,
                    remote: false,
                }),
            );
        });

        test("should not duplicate reactions from same user", async () => {
            await using client = await generateClient(users[1]);

            // Add same reaction twice
            await client.createEmojiReaction(timeline[1].id, "👍");
            const { data, ok } = await client.createEmojiReaction(
                timeline[1].id,
                "👍",
            );

            expect(ok).toBe(true);
            const thumbsReaction = data.reactions.find((r) => r.name === "👍");
            expect(thumbsReaction).toMatchObject({
                name: "👍",
                count: 1,
                me: true,
                remote: false,
            });
        });

        test("should return 404 for non-existent status", async () => {
            await using client = await generateClient(users[1]);

            const { ok, raw } = await client.createEmojiReaction(
                "00000000-0000-0000-0000-000000000000",
                "👍",
            );

            expect(ok).toBe(false);
            expect(raw.status).toBe(404);
        });
    });

    describe("DELETE (remove reaction)", () => {
        test("should return 401 if not authenticated", async () => {
            await using client = await generateClient();

            const { ok, raw } = await client.deleteEmojiReaction(
                timeline[0].id,
                "👍",
            );

            expect(ok).toBe(false);
            expect(raw.status).toBe(401);
        });

        test("should remove existing reaction", async () => {
            await using client = await generateClient(users[1]);

            // First add a reaction
            await client.createEmojiReaction(timeline[0].id, "🎉");

            // Then remove it
            const { data, ok } = await client.deleteEmojiReaction(
                timeline[0].id,
                "🎉",
            );

            expect(ok).toBe(true);
            expect(data.reactions.find((r) => r.name === "🎉")).toBeUndefined();
        });

        test("should not fail when removing non-existent reaction", async () => {
            await using client = await generateClient(users[1]);

            const { data, ok } = await client.deleteEmojiReaction(
                timeline[0].id,
                "🚀",
            );

            expect(ok).toBe(true);
            expect(data.reactions.find((r) => r.name === "🚀")).toBeUndefined();
        });

        test("should only remove own reaction", async () => {
            await using client1 = await generateClient(users[1]);
            await using client2 = await generateClient(users[2]);

            // Both users add same reaction
            await client1.createEmojiReaction(timeline[0].id, "⭐");
            await client2.createEmojiReaction(timeline[0].id, "⭐");

            // User 1 removes their reaction
            const { data, ok } = await client1.deleteEmojiReaction(
                timeline[0].id,
                "⭐",
            );

            expect(ok).toBe(true);
            const starReaction = data.reactions.find((r) => r.name === "⭐");
            expect(starReaction).toMatchObject({
                name: "⭐",
                count: 1,
                me: false, // Should be false for user 1 now
            });
        });

        test("should return 404 for non-existent status", async () => {
            await using client = await generateClient(users[1]);

            const { ok, raw } = await client.deleteEmojiReaction(
                "00000000-0000-0000-0000-000000000000",
                "👍",
            );

            expect(ok).toBe(false);
            expect(raw.status).toBe(404);
        });
    });
});
