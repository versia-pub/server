import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestStatuses, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(2, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/statuses/:id/unfavourite", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.unfavouriteStatus(timeline[0].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should be able to unfavourite post that is not favourited", async () => {
        await using client = await generateClient(users[1]);

        const { ok } = await client.unfavouriteStatus(timeline[0].id);

        expect(ok).toBe(true);
    });

    test("should unfavourite post", async () => {
        await using client = await generateClient(users[1]);

        await client.favouriteStatus(timeline[1].id);

        const { ok } = await client.unfavouriteStatus(timeline[1].id);

        expect(ok).toBe(true);

        const { ok: ok2, data } = await client.getStatus(timeline[1].id);

        expect(ok2).toBe(true);
        expect(data).toMatchObject({
            favourited: false,
            favourites_count: 0,
        });
    });

    test("post should not be favourited when fetched", async () => {
        await using client = await generateClient(users[1]);

        const { ok, data } = await client.getStatus(timeline[1].id);

        expect(ok).toBe(true);
        expect(data).toMatchObject({
            favourited: false,
            favourites_count: 0,
        });
    });
});
