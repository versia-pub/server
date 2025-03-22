import { describe, expect, test } from "bun:test";
import { generateClient } from "~/tests/utils";

// /api/v1/instance/privacy_policy
describe("/api/v1/instance/privacy_policy", () => {
    test("should return privacy policy", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getInstancePrivacyPolicy();

        expect(ok).toBe(true);
        expect(data).toEqual({
            updated_at: new Date(0).toISOString(),
            // This instance has not provided any privacy policy.
            content:
                "<p>This instance has not provided any privacy policy.</p>\n",
        });
    });
});
