import { afterAll, describe, expect, test } from "bun:test";
import type { Status as ApiStatus } from "@lysand-org/client/types";
import { config } from "~/packages/config-manager/index";
import { getTestStatuses, getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./favourite";

const { users, tokens, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(2, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/statuses/:id/favourite
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", timeline[0].id),
                    config.http.base_url,
                ),
                {
                    method: "POST",
                },
            ),
        );

        expect(response.status).toBe(401);
    });

    test("should favourite post", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", timeline[0].id),
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[1].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(200);

        const json = (await response.json()) as ApiStatus;

        expect(json.favourited).toBe(true);
        expect(json.favourites_count).toBe(1);
    });

    test("post should be favourited when fetched", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    `/api/v1/statuses/${timeline[0].id}`,
                    config.http.base_url,
                ),
                {
                    headers: {
                        Authorization: `Bearer ${tokens[1].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(200);

        const json = (await response.json()) as ApiStatus;

        expect(json.favourited).toBe(true);
        expect(json.favourites_count).toBe(1);
    });
});
