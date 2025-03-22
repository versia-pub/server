import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestStatuses, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(2, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/statuses/:id/favourite", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.favouriteStatus(timeline[0].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should favourite post", async () => {
        await using client = await generateClient(users[1]);

        const { data, ok } = await client.favouriteStatus(timeline[0].id);

        expect(ok).toBe(true);
        expect(data).toMatchObject({
            favourited: true,
            favourites_count: 1,
        });
    });

    test("post should be favourited when fetched", async () => {
        await using client = await generateClient(users[1]);

        const { data } = await client.getStatus(timeline[0].id);

        expect(data).toMatchObject({
            favourited: true,
            favourites_count: 1,
        });
    });
});
