import { afterAll, describe, expect, test } from "bun:test";
import { config } from "~index";
import {
    deleteOldTestUsers,
    getTestStatuses,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import type { APIStatus } from "~types/entities/status";
import { meta } from "./public";

await deleteOldTestUsers();

const { users, tokens, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(40, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

describe(meta.route, () => {
    test("should return 400 if limit is less than 1", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(`${meta.route}?limit=0`, config.http.base_url),
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
                new URL(`${meta.route}?limit=100`, config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(400);
    });

    test("should correctly parse limit", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(`${meta.route}?limit=5`, config.http.base_url),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const objects = (await response.json()) as APIStatus[];

        expect(objects.length).toBe(5);
    });

    test("should return 200 with statuses", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            }),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const objects = (await response.json()) as APIStatus[];

        expect(objects.length).toBe(20);
        for (const [index, status] of objects.entries()) {
            expect(status.account).toBeDefined();
            expect(status.account.id).toBe(users[0].id);
            expect(status.content).toBeDefined();
            expect(status.created_at).toBeDefined();
            expect(status.id).toBe(timeline[index].id);
        }
    });

    describe("should paginate properly", async () => {
        test("should send correct Link header", async () => {
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

            expect(response.headers.get("link")).toBe(
                `<${config.http.base_url}/api/v1/timelines/public?limit=20&max_id=${timeline[19].id}>; rel="next"`,
            );
        });

        test("should correct statuses with max", async () => {
            const response = await sendTestRequest(
                new Request(
                    new URL(
                        `${meta.route}?limit=20&max_id=${timeline[19].id}`,
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
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const objects = (await response.json()) as APIStatus[];

            expect(objects.length).toBe(20);
            for (const [index, status] of objects.entries()) {
                expect(status.account).toBeDefined();
                expect(status.account.id).toBe(users[0].id);
                expect(status.content).toBeDefined();
                expect(status.created_at).toBeDefined();
                expect(status.id).toBe(timeline[index + 20].id);
            }
        });

        test("should send correct Link prev header", async () => {
            const response = await sendTestRequest(
                new Request(
                    new URL(
                        `${meta.route}?limit=20&max_id=${timeline[19].id}`,
                        config.http.base_url,
                    ),
                    {
                        headers: {
                            Authorization: `Bearer ${tokens[0].accessToken}`,
                        },
                    },
                ),
            );

            expect(response.headers.get("link")).toInclude(
                `${config.http.base_url}/api/v1/timelines/public?limit=20&min_id=${timeline[20].id}>; rel="prev"`,
            );
        });

        test("should correct statuses with min_id", async () => {
            const response = await sendTestRequest(
                new Request(
                    new URL(
                        `${meta.route}?limit=20&min_id=${timeline[20].id}`,
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
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const objects = (await response.json()) as APIStatus[];

            expect(objects.length).toBe(20);
            for (const [index, status] of objects.entries()) {
                expect(status.account).toBeDefined();
                expect(status.account.id).toBe(users[0].id);
                expect(status.content).toBeDefined();
                expect(status.created_at).toBeDefined();
                expect(status.id).toBe(timeline[index].id);
            }
        });
    });
});
