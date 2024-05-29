import { describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { sendTestRequest } from "~/tests/utils";
import { meta } from "./extended_description";

// /api/v1/instance/extended_description
describe(meta.route, () => {
    test("should return extended description", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url)),
        );

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toEqual({
            updated_at: new Date(2024, 0, 0).toISOString(),
            // This is a [Lysand](https://lysand.org) server with the default extended description.
            content:
                '<p>This is a <a href="https://lysand.org">Lysand</a> server with the default extended description.</p>\n',
        });
    });
});
