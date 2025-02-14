import { describe, expect, test } from "bun:test";
import { fakeRequest } from "~/tests/utils";

// /api/v1/instance/terms_of_service
describe("/api/v1/instance/terms_of_service", () => {
    test("should return terms of service", async () => {
        const response = await fakeRequest("/api/v1/instance/terms_of_service");

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toEqual({
            updated_at: new Date(1970, 0, 0).toISOString(),
            // This instance has not provided any terms of service.
            content:
                "<p>This instance has not provided any terms of service.</p>\n",
        });
    });
});
