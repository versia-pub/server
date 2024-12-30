import { describe, expect, test } from "bun:test";
import { fakeRequest } from "~/tests/utils";

// /api/v2/instance
describe("/api/v2/instance", () => {
    test("should return instance information", async () => {
        const response = await fakeRequest("/api/v2/instance");

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
