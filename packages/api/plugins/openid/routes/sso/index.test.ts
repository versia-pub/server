import { afterAll, describe, expect, test } from "bun:test";
import { fakeRequest, getTestUsers } from "@versia-server/tests";

const { deleteUsers, tokens } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/sso", () => {
    test("should return empty list", async () => {
        const response = await fakeRequest("/api/v1/sso", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject([]);
    });

    test("should return an error if provider doesn't exist", async () => {
        const response = await fakeRequest("/api/v1/sso", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                issuer: "unknown",
            }),
        });

        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({
            error: "Issuer with ID unknown not found in instance's OpenID configuration",
        });
    });

    /*
    Unfortunately, we cannot test actual linking, as it requires a valid OpenID provider
    setup in config, which we don't have in tests
    */
});
