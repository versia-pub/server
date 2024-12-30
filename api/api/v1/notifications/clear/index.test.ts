import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Notification as ApiNotification } from "@versia/client/types";
import { fakeRequest, getTestUsers } from "~/tests/utils";

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

// /api/v1/notifications/clear
describe("/api/v1/notifications/clear", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest("/api/v1/notifications/clear", {
            method: "POST",
        });

        expect(response.status).toBe(401);
    });

    test("should clear notifications", async () => {
        const response = await fakeRequest("/api/v1/notifications/clear", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
        });

        expect(response.status).toBe(200);

        const newNotifications = await fakeRequest("/api/v1/notifications", {
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
        }).then((r) => r.json());

        expect(newNotifications.length).toBe(0);
    });
});
