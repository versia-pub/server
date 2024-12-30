import { describe, expect, test } from "bun:test";
import { fakeRequest } from "~/tests/utils";

// /api/v1/instance/privacy_policy
describe("/api/v1/instance/privacy_policy", () => {
    test("should return privacy policy", async () => {
        const response = await fakeRequest("/api/v1/instance/privacy_policy");

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
