import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
    deleteOldTestUsers,
    getTestStatuses,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import { config } from "~index";
import { meta } from "./index";
import type { APIStatus } from "~types/entities/status";
import type { APIAccount } from "~types/entities/account";
import { getUserUri } from "~database/entities/User";

await deleteOldTestUsers();

const { users, tokens, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/search
describe(meta.route, () => {
    test("should return 400 if q is missing", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            }),
        );

        expect(response.status).toBe(400);
    });

    test("should return 400 if q is empty", async () => {
        const response = await sendTestRequest(
            new Request(new URL(`${meta.route}?q=`, config.http.base_url), {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            }),
        );

        expect(response.status).toBe(400);
    });

    test("should return 400 if limit is less than 1", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route}?q=${users[0].username}&limit=0`,
                    config.http.base_url,
                ),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(400);
    });

    test("should return 400 if limit is greater than 80", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route}?q=${users[0].username}&limit=100`,
                    config.http.base_url,
                ),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(400);
    });

    test("should return 200 with users", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `${meta.route}?q=${users[0].username}`,
                    config.http.base_url,
                ),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(200);

        const data = (await response.json()) as APIAccount[];
        expect(data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: users[0].id,
                    username: users[0].username,
                    display_name: users[0].displayName,
                    avatar: expect.any(String),
                    header: expect.any(String),
                }),
            ]),
        );
    });
});
