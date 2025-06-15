import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);

let avatarUrl: string;

beforeAll(async () => {
    await using client = await generateClient(users[0]);

    const { ok, data } = await client.updateCredentials({
        avatar: new URL("https://placehold.co/100x100"),
    });

    expect(ok).toBe(true);

    avatarUrl = data.avatar;
});

afterAll(async () => {
    await deleteUsers();
});

describe("POST /api/v1/profile/avatar", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.deleteAvatar();

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should delete avatar", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.deleteAvatar();

        expect(ok).toBe(true);
        // Avatars are defaulted to a placeholder
        expect(data.avatar).not.toBe(avatarUrl);
    });
});
