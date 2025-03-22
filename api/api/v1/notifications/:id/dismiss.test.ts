import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { z } from "@hono/zod-openapi";
import type { Notification } from "@versia/client-ng/schemas";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);
let notifications: z.infer<typeof Notification>[] = [];

// Create some test notifications: follow, favourite, reblog, mention
beforeAll(async () => {
    await using client0 = await generateClient(users[0]);
    await using client1 = await generateClient(users[1]);

    const { ok } = await client1.followAccount(users[0].id);

    expect(ok).toBe(true);

    const { data } = await client0.getNotifications();

    expect(data).toBeArrayOfSize(1);
    notifications = data;
});

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/notifications/:id/dismiss", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.dismissNotification(
            notifications[0].id,
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should dismiss notification", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.dismissNotification(notifications[0].id);

        expect(ok).toBe(true);
    });

    test("should not display dismissed notification", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getNotifications();

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(0);
    });

    test("should not be able to dismiss other user's notifications", async () => {
        await using client = await generateClient(users[1]);

        const { ok, raw } = await client.dismissNotification(
            notifications[0].id,
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });
});
