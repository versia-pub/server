import { describe, expect, test } from "bun:test";
import { config } from "~/packages/config-manager/index";
import { sendTestRequest } from "~/tests/utils";
import { meta } from "./privacy_policy";

// /api/v1/instance/privacy_policy
describe(meta.route, () => {
    test("should return privacy policy", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url)),
        );

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toEqual({
            updated_at: new Date(1970, 0, 0).toISOString(),
            // This instance has not provided any privacy policy.
            content:
                "<p>This instance has not provided any privacy policy.</p>\n",
        });
    });
});
