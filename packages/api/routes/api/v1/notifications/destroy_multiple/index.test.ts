import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Notification } from "@versia/client/schemas";
import {
    generateClient,
    getTestStatuses,
    getTestUsers,
} from "@versia-server/tests";
import type { z } from "zod";

const { users, deleteUsers } = await getTestUsers(2);
const statuses = await getTestStatuses(5, users[0]);
let notifications: z.infer<typeof Notification>[] = [];

// Create some test notifications
beforeAll(async () => {
    await using client0 = await generateClient(users[0]);
    await using client1 = await generateClient(users[1]);

    const { ok } = await client1.followAccount(users[0].id);

    expect(ok).toBe(true);

    for (const i of [0, 1, 2, 3]) {
        await client1.favouriteStatus(statuses[i].id);
    }

    const { data } = await client0.getNotifications();

    expect(data).toBeArrayOfSize(5);
    notifications = data;
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/notifications/destroy_multiple
describe("/api/v1/notifications/destroy_multiple", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.dismissMultipleNotifications(
            notifications.slice(1).map((n) => n.id),
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should dismiss notifications", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.dismissMultipleNotifications(
            notifications.slice(1).map((n) => n.id),
        );

        expect(ok).toBe(true);
        expect(raw.status).toBe(200);
    });

    test("should not display dismissed notifications", async () => {
        await using client = await generateClient(users[0]);

        const { data } = await client.getNotifications();

        expect(data).toBeArrayOfSize(1);
        expect(data[0].id).toBe(notifications[0].id);
    });
});
