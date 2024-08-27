import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Status as ApiStatus } from "@versia/client/types";
import { fakeRequest, getTestStatuses, getTestUsers } from "~/tests/utils";
import { meta } from "./unfavourite";

const { users, tokens, deleteUsers } = await getTestUsers(5);
const timeline = (await getTestStatuses(2, users[0])).toReversed();

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/statuses/:id/unfavourite
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

    test("should be able to unfavourite post that is not favourited", async () => {
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
    });

    test("should unfavourite post", async () => {
        beforeAll(async () => {
            await fakeRequest(`/api/v1/statuses/${timeline[1].id}/favourite`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
            });
        });

        const response = await fakeRequest(
            meta.route.replace(":id", timeline[1].id),
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const json = (await response.json()) as ApiStatus;

        expect(json.favourited).toBe(false);
        expect(json.favourites_count).toBe(0);
    });

    test("post should not be favourited when fetched", async () => {
        const response = await fakeRequest(
            `/api/v1/statuses/${timeline[1].id}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens[1].accessToken}`,
                },
            },
        );

        expect(response.status).toBe(200);

        const json = (await response.json()) as ApiStatus;

        expect(json.favourited).toBe(false);
        expect(json.favourites_count).toBe(0);
    });
});
