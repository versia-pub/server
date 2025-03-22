import { describe, expect, test } from "bun:test";
import { generateClient } from "~/tests/utils";

// /api/v1/instance/terms_of_service
describe("/api/v1/instance/terms_of_service", () => {
    test("should return terms of service", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getInstanceTermsOfService();

        expect(ok).toBe(true);
        expect(data).toEqual({
            updated_at: new Date(0).toISOString(),
            // This instance has not provided any terms of service.
            content:
                "<p>This instance has not provided any terms of service.</p>\n",
        });
    });
});
