import { describe, expect, test } from "bun:test";
import { fakeRequest } from "~/tests/utils";
import { meta } from "./index.ts";

// /api/v2/instance
describe(meta.route, () => {
    test("should return instance information", async () => {
        const response = await fakeRequest(meta.route);

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
            "sso",
        ]);
    });
});
