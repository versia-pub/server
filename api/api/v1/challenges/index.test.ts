import { describe, expect, test } from "bun:test";
import { fakeRequest } from "~/tests/utils";

// /api/v1/challenges
describe("/api/v1/challenges", () => {
    test("should get a challenge", async () => {
        const response = await fakeRequest("/api/v1/challenges", {
            method: "POST",
        });

        expect(response.status).toBe(200);

        const body = await response.json();

        expect(body).toMatchObject({
            id: expect.any(String),
            algorithm: expect.any(String),
            challenge: expect.any(String),
            maxnumber: expect.any(Number),
            salt: expect.any(String),
            signature: expect.any(String),
        });
    });
});
