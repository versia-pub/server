import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import {
    deleteOldTestUsers,
    getTestStatuses,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import type { Notification as APINotification } from "~types/mastodon/notification";
import { meta } from "./index";

await deleteOldTestUsers();

const { users, tokens, deleteUsers } = await getTestUsers(2);
const timeline = (await getTestStatuses(40, users[0])).toReversed();
// Create some test notifications: follow, favourite, reblog, mention
beforeAll(async () => {
    await fetch(
        new URL(`/api/v1/accounts/${users[0].id}/follow`, config.http.base_url),
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[1].accessToken}`,
            },
        },
    );

    await fetch(
        new URL(
            `/api/v1/statuses/${timeline[0].id}/favourite`,
            config.http.base_url,
        ),
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[1].accessToken}`,
            },
        },
    );

    await fetch(
        new URL(
            `/api/v1/statuses/${timeline[0].id}/reblog`,
            config.http.base_url,
        ),
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[1].accessToken}`,
            },
        },
    );

    await fetch(new URL("/api/v1/statuses", config.http.base_url), {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens[1].accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            status: `@${users[0].username} test mention`,
            visibility: "direct",
            federate: false,
        }),
    });
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/notifications
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url)),
        );

        expect(response.status).toBe(401);
    });

    test("should return 200 with notifications", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            }),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const objects = (await response.json()) as APINotification[];

        expect(objects.length).toBe(4);
        for (const [index, notification] of objects.entries()) {
            expect(notification.account).toBeDefined();
            expect(notification.account?.id).toBe(users[1].id);
            expect(notification.created_at).toBeDefined();
            expect(notification.id).toBeDefined();
            expect(notification.type).toBeDefined();
            expect(notification.type).toBe(
                ["follow", "favourite", "reblog", "mention"].toReversed()[
                    index
                ],
            );
        }
    });

    test("should not return notifications with filtered keywords", async () => {
        const formData = new FormData();

        formData.append("title", "Test Filter");
        formData.append("context[]", "notifications");
        formData.append("filter_action", "hide");
        formData.append(
            "keywords_attributes[0][keyword]",
            timeline[0].content.slice(4, 20),
        );
        formData.append("keywords_attributes[0][whole_word]", "false");

        const filterResponse = await sendTestRequest(
            new Request(new URL("/api/v2/filters", config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: formData,
            }),
        );

        expect(filterResponse.status).toBe(200);

        const response = await sendTestRequest(
            new Request(
                new URL(`${meta.route}?limit=20`, config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const objects = (await response.json()) as APINotification[];

        expect(objects.length).toBe(3);
        // There should be no element with a status with id of timeline[0].id
        expect(objects).not.toContainEqual(
            expect.objectContaining({
                status: expect.objectContaining({ id: timeline[0].id }),
            }),
        );

        // Delete filter
        const filterDeleteResponse = await sendTestRequest(
            new Request(
                new URL(
                    `/api/v2/filters/${(await filterResponse.json()).id}`,
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

        expect(filterDeleteResponse.status).toBe(200);
    });
});
