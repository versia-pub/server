import { afterAll, describe, expect, test } from "bun:test";
import type { Status as ApiStatus } from "@lysand-org/client/types";
import { config } from "~/packages/config-manager/index";
import { getTestStatuses, getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./home";

const { users, tokens, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(40, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url)),
        );

        expect(response.status).toBe(401);
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

        const objects = (await response.json()) as ApiStatus[];

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

        const objects = (await response.json()) as ApiStatus[];

        expect(objects.length).toBe(20);
        for (const [index, status] of objects.entries()) {
            expect(status.account).toBeDefined();
            expect(status.account.id).toBe(users[0].id);
            expect(status.content).toBeDefined();
            expect(status.created_at).toBeDefined();
            expect(status.id).toBe(timeline[index].id);
        }
    });

    describe("should paginate properly", () => {
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
                `<${config.http.base_url}/api/v1/timelines/home?limit=20&max_id=${timeline[19].id}>; rel="next"`,
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

            const objects = (await response.json()) as ApiStatus[];

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
                `${config.http.base_url}/api/v1/timelines/home?limit=20&min_id=${timeline[20].id}>; rel="prev"`,
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

            const objects = (await response.json()) as ApiStatus[];

            expect(objects.length).toBe(20);
            for (const [index, status] of objects.entries()) {
                expect(status.account).toBeDefined();
                expect(status.account.id).toBe(users[0].id);
                expect(status.content).toBeDefined();
                expect(status.created_at).toBeDefined();
                expect(status.id).toBe(timeline[index].id);
            }
        });

        test("should not return statuses with filtered keywords", async () => {
            const filterResponse = await sendTestRequest(
                new Request(new URL("/api/v2/filters", config.http.base_url), {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        title: "Test Filter",
                        "context[]": "home",
                        filter_action: "hide",
                        "keywords_attributes[0][keyword]":
                            timeline[0].content.slice(4, 20),
                        "keywords_attributes[0][whole_word]": "false",
                    }),
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
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const objects = (await response.json()) as ApiStatus[];

            expect(objects.length).toBe(20);
            // There should be no element with id of timeline[0].id
            expect(objects).not.toContainEqual(
                expect.objectContaining({ id: timeline[0].id }),
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
});
