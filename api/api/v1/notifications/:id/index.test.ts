import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Notification as ApiNotification } from "@versia/client/types";
import { fakeRequest, getTestUsers } from "~/tests/utils";
import { meta } from "./index.ts";

const { users, tokens, deleteUsers } = await getTestUsers(2);
let notifications: ApiNotification[] = [];

// Create some test notifications: follow, favourite, reblog, mention
beforeAll(async () => {
    await fakeRequest(`/api/v1/accounts/${users[0].id}/follow`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens[1].data.accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    notifications = await fakeRequest("/api/v1/notifications", {
        headers: {
            Authorization: `Bearer ${tokens[0].data.accessToken}`,
        },
    }).then((r) => r.json());

    expect(notifications.length).toBe(1);
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/notifications/:id
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", "00000000-0000-0000-0000-000000000000"),
        );

        expect(response.status).toBe(401);
    });

    test("should return 422 if ID is invalid", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", "invalid"),
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );
        expect(response.status).toBe(422);
    });

    test("should return 404 if notification not found", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", "00000000-0000-0000-0000-000000000000"),
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(404);
    });

    test("should return notification", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", notifications[0].id),
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const notification = (await response.json()) as ApiNotification;

        expect(notification).toBeDefined();
        expect(notification.id).toBe(notifications[0].id);
        expect(notification.type).toBe("follow");
        expect(notification.account).toBeDefined();
        expect(notification.account?.id).toBe(users[1].id);
    });

    test("should not be able to view other user's notifications", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", notifications[0].id),
            {
                headers: {
                    Authorization: `Bearer ${tokens[1].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(404);
    });
});
