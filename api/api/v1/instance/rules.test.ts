import { describe, expect, test } from "bun:test";
import { config } from "~/packages/config-manager/index";
import { fakeRequest } from "~/tests/utils";
import { meta } from "./rules";

// /api/v1/instance/rules
describe(meta.route, () => {
    test("should return rules", async () => {
        const response = await fakeRequest(meta.route);

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
