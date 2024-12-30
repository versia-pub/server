import { describe, expect, test } from "bun:test";
import { config } from "~/packages/config-manager/index.ts";
import { fakeRequest } from "~/tests/utils";

// /api/v1/instance/rules
describe("/api/v1/instance/rules", () => {
    test("should return rules", async () => {
        const response = await fakeRequest("/api/v1/instance/rules");

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toEqual(
            config.signups.rules.map((rule, index) => ({
                id: String(index),
                text: rule,
                hint: "",
            })),
        );
    });
});
