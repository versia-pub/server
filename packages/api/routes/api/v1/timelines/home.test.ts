import { afterAll, describe, expect, test } from "bun:test";
import { config } from "@versia-server/config";
import {
    generateClient,
    getTestStatuses,
    getTestUsers,
} from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(10, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/timelines/home", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getHomeTimeline();

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should correctly parse limit", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getHomeTimeline({
            limit: 2,
        });

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(2);
    });

    test("should return 200 with statuses", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getHomeTimeline({
            limit: 5,
        });

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(5);
        for (const [index, status] of data.entries()) {
            expect(status.account).toBeDefined();
            expect(status.account.id).toBe(users[0].id);
            expect(status.content).toBeDefined();
            expect(status.created_at).toBeDefined();
            expect(status.id).toBe(timeline[index].id);
        }
    });

    describe("should paginate properly", () => {
        test("should send correct Link header", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok, raw } = await client.getHomeTimeline({
                limit: 5,
            });

            expect(ok).toBe(true);
            expect(data).toBeArrayOfSize(5);
            expect(raw.headers.get("link")).toBe(
                `<${config.http.base_url}api/v1/timelines/home?limit=5&max_id=${timeline[4].id}>; rel="next"`,
            );
        });

        test("should correct statuses with max", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok } = await client.getHomeTimeline({
                limit: 5,
                max_id: timeline[4].id,
            });

            expect(ok).toBe(true);
            expect(data).toBeArrayOfSize(5);
            for (const [index, status] of data.entries()) {
                expect(status.account).toBeDefined();
                expect(status.account.id).toBe(users[0].id);
                expect(status.content).toBeDefined();
                expect(status.created_at).toBeDefined();
                expect(status.id).toBe(timeline[index + 5].id);
            }
        });

        test("should send correct Link prev header", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok, raw } = await client.getHomeTimeline({
                limit: 5,
                max_id: timeline[4].id,
            });

            expect(ok).toBe(true);
            expect(data).toBeArrayOfSize(5);
            expect(raw.headers.get("link")).toInclude(
                `<${config.http.base_url}api/v1/timelines/home?limit=5&min_id=${timeline[5].id}>; rel="prev"`,
            );
        });

        test("should correct statuses with min_id", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok } = await client.getHomeTimeline({
                limit: 5,
                min_id: timeline[5].id,
            });

            expect(ok).toBe(true);
            expect(data).toBeArrayOfSize(5);
            for (const [index, status] of data.entries()) {
                expect(status.account).toBeDefined();
                expect(status.account.id).toBe(users[0].id);
                expect(status.content).toBeDefined();
                expect(status.created_at).toBeDefined();
                expect(status.id).toBe(timeline[index].id);
            }
        });

        test("should not return statuses with filtered keywords", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok } = await client.createFilter(
                ["home"],
                "Test Filter",
                "hide",
                {
                    keywords_attributes: [
                        {
                            keyword: timeline[0].content.slice(4, 20),
                            whole_word: false,
                        },
                    ],
                },
            );

            expect(ok).toBe(true);

            const { data: data2, ok: ok2 } = await client.getHomeTimeline({
                limit: 5,
            });

            expect(ok2).toBe(true);
            expect(data2).toBeArrayOfSize(5);
            // There should be no element with id of timeline[0].id
            expect(data2).not.toContainEqual(
                expect.objectContaining({ id: timeline[0].id }),
            );

            // Delete filter
            const { ok: ok3 } = await client.deleteFilter(data.id);

            expect(ok3).toBe(true);
        });
    });
});
