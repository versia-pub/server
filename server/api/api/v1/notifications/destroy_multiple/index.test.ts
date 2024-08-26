import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Notification as ApiNotification } from "@versia/client/types";
import { config } from "~/packages/config-manager/index";
import { getTestStatuses, getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./index";

const { users, tokens, deleteUsers } = await getTestUsers(2);
const statuses = await getTestStatuses(40, users[0]);
let notifications: ApiNotification[] = [];

// Create some test notifications
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

    for (const i of [0, 1, 2, 3]) {
        await sendTestRequest(
            new Request(
                new URL(
                    `/api/v1/statuses/${statuses[i].id}/favourite`,
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
    }

    notifications = await sendTestRequest(
        new Request(new URL("/api/v1/notifications", config.http.base_url), {
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
            },
        }),
    ).then((r) => r.json());

    expect(notifications.length).toBe(5);
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/notifications/destroy_multiple
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route}?${new URLSearchParams(
                        notifications.slice(1).map((n) => ["ids[]", n.id]),
                    ).toString()}`,
                    config.http.base_url,
                ),
                {
                    method: "DELETE",
                },
            ),
        );

        expect(response.status).toBe(401);
    });

    test("should dismiss notifications", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route}?${new URLSearchParams(
                        notifications.slice(1).map((n) => ["ids[]", n.id]),
                    ).toString()}`,
                    config.http.base_url,
                ),
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(200);
    });

    test("should not display dismissed notification", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL("/api/v1/notifications", config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(200);

        const output = await response.json();

        expect(output.length).toBe(1);
    });
});
