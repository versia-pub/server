import { afterAll, describe, expect, test } from "bun:test";
import { fakeRequest, getTestUsers } from "@versia-server/tests";

const { deleteUsers, tokens } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/sso/:id
describe("/api/v1/sso/:id", () => {
    test("should not find unknown issuer", async () => {
        const response = await fakeRequest("/api/v1/sso/unknown", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
        });

        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({
            error: "Issuer with ID unknown not found in instance's OpenID configuration",
        });

        const response2 = await fakeRequest("/api/v1/sso/unknown", {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        expect(response2.status).toBe(404);
        expect(await response2.json()).toMatchObject({
            error: "Issuer with ID unknown not found in instance's OpenID configuration",
        });
    });
});
