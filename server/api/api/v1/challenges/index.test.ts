import { describe, expect, test } from "bun:test";
import { config } from "~/packages/config-manager/index";
import { sendTestRequest } from "~/tests/utils";
import { meta } from "./index";

// /api/v1/challenges
describe(meta.route, () => {
    test("should get a challenge", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
            }),
        );

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
