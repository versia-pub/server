import { describe, expect, test } from "bun:test";
import { meta } from "./rules";
import { sendTestRequest } from "~tests/utils";
import { config } from "config-manager";

// /api/v1/instance/rules
describe(meta.route, () => {
    test("should return rules", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url)),
        );

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toEqual(
            config.signups.rules.map((rule, index) => ({
                id: String(index),
                text: rule,
            })),
        );
    });
});
