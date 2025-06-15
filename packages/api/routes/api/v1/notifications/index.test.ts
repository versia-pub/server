import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
    generateClient,
    getTestStatuses,
    getTestUsers,
} from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(2);
const timeline = (await getTestStatuses(5, users[0])).toReversed();
// Create some test notifications: follow, favourite, reblog, mention
beforeAll(async () => {
    await using client = await generateClient(users[1]);

    const { ok } = await client.followAccount(users[0].id);

    expect(ok).toBe(true);

    const { ok: ok2 } = await client.favouriteStatus(timeline[0].id);

    expect(ok2).toBe(true);

    const { ok: ok3 } = await client.reblogStatus(timeline[0].id);

    expect(ok3).toBe(true);

    const { ok: ok4 } = await client.postStatus(
        `@${users[0].data.username} test mention`,
        {
            visibility: "direct",
            local_only: true,
        },
    );

    expect(ok4).toBe(true);
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/notifications
describe("/api/v1/notifications", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getNotifications();

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 200 with notifications", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getNotifications();

        expect(ok).toBe(true);
        expect(data.length).toBe(4);
        for (const [index, notification] of data.entries()) {
            expect(notification.account).toBeDefined();
            expect(notification.account?.id).toBe(users[1].id);
            expect(notification.created_at).toBeDefined();
            expect(notification.id).toBeDefined();
            expect(notification.type).toBeDefined();
            expect(notification.type).toBe(
                ["follow", "favourite", "reblog", "mention"].toReversed()[
                    index
                ] as "follow" | "favourite" | "reblog" | "mention",
            );
        }
    });

    test("should not return notifications with filtered keywords", async () => {
        await using client = await generateClient(users[0]);

        const { data: filter, ok } = await client.createFilter(
            ["notifications"],
            "Test Filter",
            "hide",
            {
                keywords_attributes: [
                    {
                        keyword: timeline[0].content.slice(4, 20),
                        whole_word: false,
                    },
                ],
            },
        );

        expect(ok).toBe(true);

        const { data: notifications } = await client.getNotifications();

        expect(notifications.length).toBe(3);
        // There should be no element with a status with id of timeline[0].id
        expect(notifications).not.toContainEqual(
            expect.objectContaining({
                status: expect.objectContaining({ id: timeline[0].id }),
            }),
        );

        // Delete filter
        const { ok: ok2 } = await client.deleteFilter(filter.id);

        expect(ok2).toBe(true);
    });
});
