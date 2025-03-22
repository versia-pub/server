import { describe, expect, test } from "bun:test";
import { config } from "~/config.ts";
import { generateClient } from "~/tests/utils";

// /api/v1/instance/rules
describe("/api/v1/instance/rules", () => {
    test("should return rules", async () => {
        await using client = await generateClient();

        const { data, ok } = await client.getRules();

        expect(ok).toBe(true);
        expect(data).toEqual(
            config.instance.rules.map((r, index) => ({
                id: String(index),
                text: r.text,
                hint: r.hint,
            })),
        );
    });
});
