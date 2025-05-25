import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestStatuses, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(3);
const timeline = (await getTestStatuses(2, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/statuses/:id/reactions", () => {
    test("should return empty array when no reactions", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getStatusReactions(timeline[0].id);

        expect(ok).toBe(true);
        expect(data).toEqual([]);
    });

    test("should return reactions after adding some", async () => {
        await using client1 = await generateClient(users[1]);
        await using client2 = await generateClient(users[2]);

        // Add some reactions
        await client1.createEmojiReaction(timeline[0].id, "👍");
        await client2.createEmojiReaction(timeline[0].id, "❤️");
        await client1.createEmojiReaction(timeline[0].id, "😂");

        const { data, ok } = await client1.getStatusReactions(timeline[0].id);

        expect(ok).toBe(true);
        expect(data).toHaveLength(3);

        // Check for 👍 reaction
        const thumbsUp = data.find((r) => r.name === "👍");
        expect(thumbsUp).toMatchObject({
            name: "👍",
            count: 1,
            me: true,
            account_ids: [users[1].id],
        });

        // Check for ❤️ reaction
        const heart = data.find((r) => r.name === "❤️");
        expect(heart).toMatchObject({
            name: "❤️",
            count: 1,
            me: false,
            account_ids: [users[2].id],
        });

        // Check for 😂 reaction
        const laugh = data.find((r) => r.name === "😂");
        expect(laugh).toMatchObject({
            name: "😂",
            count: 1,
            me: true,
            account_ids: [users[1].id],
        });
    });

    test("should work without authentication", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getStatusReactions(timeline[0].id);

        expect(ok).toBe(true);
        expect(data).toHaveLength(3);

        // All reactions should have me: false when not authenticated
        for (const reaction of data) {
            expect(reaction.me).toBe(false);
        }
    });
});
