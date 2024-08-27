import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Notification as ApiNotification } from "@versia/client/types";
import { config } from "~/packages/config-manager/index";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./index";

const { users, tokens, deleteUsers } = await getTestUsers(2);
let notifications: ApiNotification[] = [];

// Create some test notifications: follow, favourite, reblog, mention
beforeAll(async () => {
    await sendTestRequest(
        new Request(
            new URL(
                `/api/v1/accounts/${users[0].id}/follow`,
                config.http.base_url,
            ),
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
        ),
    );

    notifications = await sendTestRequest(
        new Request(new URL("/api/v1/notifications", config.http.base_url), {
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
            },
        }),
    ).then((r) => r.json());

    expect(notifications.length).toBe(1);
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/notifications/clear
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
            }),
        );

        expect(response.status).toBe(401);
    });

    test("should clear notifications", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            }),
        );

        expect(response.status).toBe(200);

        const newNotifications = await sendTestRequest(
            new Request(
                new URL("/api/v1/notifications", config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        ).then((r) => r.json());

        expect(newNotifications.length).toBe(0);
    });
});
