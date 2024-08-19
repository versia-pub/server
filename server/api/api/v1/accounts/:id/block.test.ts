import { afterAll, describe, expect, test } from "bun:test";
import type { Relationship as ApiRelationship } from "@lysand-org/client/types";
import { config } from "~/packages/config-manager/index";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./block";

const { users, tokens, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/:id/block
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", users[1].id),
                    config.http.base_url,
                ),
                {
                    method: "POST",
                },
            ),
        );
        expect(response.status).toBe(401);
    });

    test("should return 404 if user not found", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(
                        ":id",
                        "00000000-0000-0000-0000-000000000000",
                    ),
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );
        expect(response.status).toBe(404);
    });

    test("should block user", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", users[1].id),
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );
        expect(response.status).toBe(200);

        const relationship = (await response.json()) as ApiRelationship;
        expect(relationship.blocking).toBe(true);
    });

    test("should return 200 if user already blocked", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", users[1].id),
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );
        expect(response.status).toBe(200);

        const relationship = (await response.json()) as ApiRelationship;
        expect(relationship.blocking).toBe(true);
    });
});
