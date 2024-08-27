import { afterAll, describe, expect, test } from "bun:test";
import type { Status as ApiStatus } from "@versia/client/types";
import { fakeRequest, getTestStatuses, getTestUsers } from "~/tests/utils";
import { meta } from "./favourite";

const { users, tokens, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(2, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/statuses/:id/favourite
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", timeline[0].id),
            {
                method: "POST",
            },
        );

        expect(response.status).toBe(401);
    });

    test("should favourite post", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", timeline[0].id),
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const json = (await response.json()) as ApiStatus;

        expect(json.favourited).toBe(true);
        expect(json.favourites_count).toBe(1);
    });

    test("post should be favourited when fetched", async () => {
        const response = await fakeRequest(
            `/api/v1/statuses/${timeline[0].id}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const json = (await response.json()) as ApiStatus;

        expect(json.favourited).toBe(true);
        expect(json.favourites_count).toBe(1);
    });
});
