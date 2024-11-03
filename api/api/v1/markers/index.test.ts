import { afterAll, describe, expect, test } from "bun:test";
import { fakeRequest, getTestStatuses, getTestUsers } from "~/tests/utils";
import { meta } from "./index.ts";

const { users, tokens, deleteUsers } = await getTestUsers(1);
const timeline = await getTestStatuses(10, users[0]);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/markers
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(meta.route, {
            method: "GET",
        });
        expect(response.status).toBe(401);
    });

    test("should return empty markers", async () => {
        const response = await fakeRequest(
            `${meta.route}?${new URLSearchParams([
                ["timeline[]", "home"],
                ["timeline[]", "notifications"],
            ])}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({});
    });

    test("should create markers", async () => {
        const response = await fakeRequest(
            `${meta.route}?${new URLSearchParams({
                "home[last_read_id]": timeline[0].id,
            })}`,

            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            home: {
                last_read_id: timeline[0].id,
                updated_at: expect.any(String),
                version: 1,
            },
        });
    });

    test("should return markers", async () => {
        const response = await fakeRequest(
            `${meta.route}?${new URLSearchParams([
                ["timeline[]", "home"],
                ["timeline[]", "notifications"],
            ])}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            home: {
                last_read_id: timeline[0].id,
                updated_at: expect.any(String),
                version: 1,
            },
        });
    });
});
