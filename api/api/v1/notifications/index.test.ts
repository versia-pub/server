import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Notification as ApiNotification } from "@versia/client/types";
import { fakeRequest, getTestStatuses, getTestUsers } from "~/tests/utils";
import { meta } from "./index.ts";

const getFormData = (
    object: Record<string, string | number | boolean>,
): FormData =>
    Object.keys(object).reduce((formData, key) => {
        formData.append(key, String(object[key]));
        return formData;
    }, new FormData());

const { users, tokens, deleteUsers } = await getTestUsers(2);
const timeline = (await getTestStatuses(40, users[0])).toReversed();
// Create some test notifications: follow, favourite, reblog, mention
beforeAll(async () => {
    const res1 = await fakeRequest(`/api/v1/accounts/${users[0].id}/follow`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens[1].accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    expect(res1.status).toBe(200);

    const res2 = await fakeRequest(
        `/api/v1/statuses/${timeline[0].id}/favourite`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[1].accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        },
    );

    expect(res2.status).toBe(200);

    const res3 = await fakeRequest(
        `/api/v1/statuses/${timeline[0].id}/reblog`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[1].accessToken}`,
            },
            body: getFormData({}),
        },
    );

    expect(res3.status).toBe(201);

    const res4 = await fakeRequest("/api/v1/statuses", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens[1].accessToken}`,
        },
        body: new URLSearchParams({
            status: `@${users[0].data.username} test mention`,
            visibility: "direct",
            local_only: "true",
        }),
    });

    expect(res4.status).toBe(201);
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/notifications
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(meta.route);

        expect(response.status).toBe(401);
    });

    test("should return 200 with notifications", async () => {
        const response = await fakeRequest(meta.route, {
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
            },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );

        const objects = (await response.json()) as ApiNotification[];

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
        const filterResponse = await fakeRequest("/api/v2/filters", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                title: "Test Filter",
                "context[]": "notifications",
                filter_action: "hide",
                "keywords_attributes[0][keyword]": timeline[0].content.slice(
                    4,
                    20,
                ),
                "keywords_attributes[0][whole_word]": "false",
            }),
        });

        expect(filterResponse.status).toBe(200);

        const response = await fakeRequest(`${meta.route}?limit=20`, {
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
            },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );

        const objects = (await response.json()) as ApiNotification[];

        expect(objects.length).toBe(2);
        // There should be no element with a status with id of timeline[0].id
        expect(objects).not.toContainEqual(
            expect.objectContaining({
                status: expect.objectContaining({ id: timeline[0].id }),
            }),
        );

        // Delete filter
        const filterDeleteResponse = await fakeRequest(
            `/api/v2/filters/${(await filterResponse.json()).id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            },
        );

        expect(filterDeleteResponse.status).toBe(204);
    });
});
