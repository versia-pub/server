import { describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { sendTestRequest } from "~tests/utils";
import { meta } from "./index";

// /api/v2/instance
describe(meta.route, () => {
    test("should return instance information", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url)),
        );

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toBeObject();
        expect(json).toContainKeys([
            "domain",
            "title",
            "version",
            "source_url",
            "description",
            "usage",
            "thumbnail",
            "languages",
            "configuration",
            "registrations",
            "contact",
            "rules",
        ]);
    });
});
