import { describe, expect, test } from "bun:test";
import { generateClient } from "@versia-server/tests";

// /api/v1/instance/extended_description
describe("/api/v1/instance/extended_description", () => {
    test("should return extended description", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getInstanceExtendedDescription();

        expect(ok).toBe(true);
        expect(data).toEqual({
            updated_at: new Date(0).toISOString(),
            content:
                '<p>This is a <a href="https://versia.pub">Versia</a> server with the default extended description.</p>\n',
        });
    });
});
