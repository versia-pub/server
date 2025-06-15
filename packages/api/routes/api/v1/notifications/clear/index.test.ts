import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(2);

// Create some test notifications: follow, favourite, reblog, mention
beforeAll(async () => {
    await using client1 = await generateClient(users[1]);
    await using client0 = await generateClient(users[0]);

    const { ok } = await client1.followAccount(users[0].id);

    expect(ok).toBe(true);

    const { data, ok: ok2 } = await client0.getNotifications();

    expect(ok2).toBe(true);
    expect(data).toBeArrayOfSize(1);
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/notifications/clear
describe("/api/v1/notifications/clear", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.dismissNotifications();

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should clear notifications", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.dismissNotifications();

        expect(ok).toBe(true);

        const { data: newNotifications } = await client.getNotifications();

        expect(newNotifications).toBeArrayOfSize(0);
    });
});
