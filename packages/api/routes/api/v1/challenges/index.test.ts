import { describe, expect, test } from "bun:test";
import { generateClient } from "@versia-server/tests";

// /api/v1/challenges
describe("/api/v1/challenges", () => {
    test("should get a challenge", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getChallenge();

        expect(ok).toBe(true);
        expect(data).toMatchObject({
            id: expect.any(String),
            algorithm: expect.any(String),
            challenge: expect.any(String),
            maxnumber: expect.any(Number),
            salt: expect.any(String),
            signature: expect.any(String),
        });
    });
});
