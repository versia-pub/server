import { afterAll, describe, expect, test } from "bun:test";
import type { Status as ApiStatus } from "@versia/client/types";
import { config } from "~/packages/config-manager/index";
import { fakeRequest, getTestStatuses, getTestUsers } from "~/tests/utils";
import { meta } from "./public";

const { users, tokens, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(40, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

describe(meta.route, () => {
    test("should correctly parse limit", async () => {
        const response = await fakeRequest(`${meta.route}?limit=5`, {
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
            },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );

        const objects = (await response.json()) as ApiStatus[];

        expect(objects.length).toBe(5);
    });

    test("should return 200 with statuses", async () => {
        const response = await fakeRequest(meta.route, {
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
            },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
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

    test("should only fetch local statuses", async () => {
        const response = await fakeRequest(
            `${meta.route}?limit=20&local=true`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
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

    test("should only fetch remote statuses", async () => {
        const response = await fakeRequest(
            `${meta.route}?remote=true&allow_local_only=false&only_media=false`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );

        const objects = (await response.json()) as ApiStatus[];

        expect(objects).toBeArray();
    });

    describe("should paginate properly", () => {
        test("should send correct Link header", async () => {
            const response = await fakeRequest(`${meta.route}?limit=20`, {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            });

            expect(response.headers.get("link")).toBe(
                `<${config.http.base_url}/api/v1/timelines/public?limit=20&max_id=${timeline[19].id}>; rel="next"`,
            );
        });

        test("should correct statuses with max", async () => {
            const response = await fakeRequest(
                `${meta.route}?limit=20&max_id=${timeline[19].id}`,
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
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
            const response = await fakeRequest(
                `${meta.route}?limit=20&max_id=${timeline[19].id}`,
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            );

            expect(response.headers.get("link")).toInclude(
                `${config.http.base_url}/api/v1/timelines/public?limit=20&min_id=${timeline[20].id}>; rel="prev"`,
            );
        });

        test("should correct statuses with min_id", async () => {
            const response = await fakeRequest(
                `${meta.route}?limit=20&min_id=${timeline[20].id}`,
                {
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
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
    });

    test("should not return statuses with filtered keywords", async () => {
        const filterResponse = await fakeRequest("/api/v2/filters", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                title: "Test Filter",
                "context[]": "public",
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

        const objects = (await response.json()) as ApiStatus[];

        expect(objects.length).toBe(20);
        // There should be no element with id of timeline[0].id
        expect(objects).not.toContainEqual(
            expect.objectContaining({ id: timeline[0].id }),
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
