import { describe, expect, test } from "bun:test";
import { fakeRequest } from "~/tests/utils";
import { meta } from "./extended_description";

// /api/v1/instance/extended_description
describe(meta.route, () => {
    test("should return extended description", async () => {
        const response = await fakeRequest(meta.route);

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toEqual({
            updated_at: new Date(1970, 0, 0).toISOString(),
            content:
                '<p>This is a <a href="https://versia.pub">Versia</a> server with the default extended description.</p>\n',
        });
    });
});
