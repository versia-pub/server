import { describe, expect, test } from "bun:test";
import { fakeRequest } from "~/tests/utils";
import { meta } from "./tos";

// /api/v1/instance/tos
describe(meta.route, () => {
    test("should return terms of service", async () => {
        const response = await fakeRequest(meta.route);

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
