import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { z } from "@hono/zod-openapi";
import type { Notification } from "@versia/client-ng/schemas";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);
let notifications: z.infer<typeof Notification>[] = [];

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

// /api/v1/notifications/:id
describe("/api/v1/notifications/:id", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getNotification(notifications[0].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 422 if ID is invalid", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.getNotification("invalid");

        expect(ok).toBe(false);
        expect(raw.status).toBe(422);
    });

    test("should return 404 if notification not found", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.getNotification(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should return notification", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getNotification(notifications[0].id);

        expect(ok).toBe(true);

        expect(data).toBeDefined();
        expect(data.id).toBe(notifications[0].id);
        expect(data.type).toBe("follow");
        expect(data.account).toBeDefined();
        expect(data.account?.id).toBe(users[1].id);
    });

    test("should not be able to view other user's notifications", async () => {
        await using client = await generateClient(users[1]);

        const { ok, raw } = await client.getNotification(notifications[0].id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });
});
