import { describe, expect, test } from "bun:test";
import { fakeRequest } from "~/tests/utils";

// /api/v1/instance/extended_description
describe("/api/v1/instance/extended_description", () => {
    test("should return extended description", async () => {
        const response = await fakeRequest(
            "/api/v1/instance/extended_description",
        );

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toEqual({
            updated_at: new Date(0).toISOString(),
            content:
                '<p>This is a <a href="https://versia.pub">Versia</a> server with the default extended description.</p>\n',
        });
    });
});
