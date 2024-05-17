import { afterAll, describe, expect, test } from "bun:test";
import { config } from "~packages/config-manager";
import {
    deleteOldTestUsers,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import { meta } from "./index";

await deleteOldTestUsers();

const { deleteUsers, tokens } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/sso/:id
describe(meta.route, () => {
    test("should not find unknown issuer", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", "unknown"),
                    config.http.base_url,
                ),
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${tokens[0]?.accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({
            error: "Issuer not found",
        });

        const response2 = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", "unknown"),
                    config.http.base_url,
                ),
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${tokens[0]?.accessToken}`,
                        "Content-Type": "application/json",
                    },
                },
            ),
        );

        expect(response2.status).toBe(404);
        expect(await response2.json()).toMatchObject({
            error: "Issuer not found",
        });
    });

    /*
    Unfortunately, we cannot test actual linking, as it requires a valid OpenID provider
    setup in config, which we don't have in tests
    */
});
