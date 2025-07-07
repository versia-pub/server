import { describe, expect, test } from "bun:test";
import { generateClient } from "@versia-server/tests";

// /api/v2/instance
describe("/api/v2/instance", () => {
    test("should return instance information", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getInstance();

        expect(ok).toBe(true);
        expect(data).toBeObject();
        expect(data).toContainKeys([
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
