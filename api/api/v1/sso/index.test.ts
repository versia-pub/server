import { afterAll, describe, expect, test } from "bun:test";
import { config } from "~/packages/config-manager";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./index";

const { deleteUsers, tokens } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/sso
describe(meta.route, () => {
    test("should return empty list", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokens[0]?.accessToken}`,
                },
            }),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject([]);
    });

    test("should return an error if provider doesn't exist", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0]?.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    issuer: "unknown",
                }),
            }),
        );

        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({
            error: "Issuer unknown not found",
        });
    });

    /*
    Unfortunately, we cannot test actual linking, as it requires a valid OpenID provider
    setup in config, which we don't have in tests
    */
});
