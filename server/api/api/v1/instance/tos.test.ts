import { describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { sendTestRequest } from "~/tests/utils";
import { meta } from "./tos";

// /api/v1/instance/tos
describe(meta.route, () => {
    test("should return terms of service", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url)),
        );

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
