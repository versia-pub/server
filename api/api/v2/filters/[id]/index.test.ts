import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);

await using client = await generateClient(users[0]);

const { data: filter, ok } = await client.createFilter(
    ["home"],
    "Test Filter",
    "warn",
    {
        expires_in: 86400,
        keywords_attributes: [{ keyword: "test", whole_word: true }],
    },
);

expect(ok).toBe(true);
expect(filter).toBeObject();
expect(filter).toContainKeys(["id", "title"]);
expect(filter.title).toBe("Test Filter");

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v2/filters/:id", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getFilter(filter.id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should get that filter", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getFilter(filter.id);

        expect(ok).toBe(true);
        expect(data).toBeObject();
        expect(data).toContainKeys(["id", "title"]);
        expect(data.title).toBe("Test Filter");
        expect(data.context).toEqual(["home"]);
        expect(data.filter_action).toBe("warn");
        expect(data.expires_at).toBeString();
        expect(data.keywords).toBeArray();
        expect(data.keywords).not.toBeEmpty();
        expect(data.keywords[0]).toContainKeys(["keyword", "whole_word"]);
        expect(data.keywords[0].keyword).toEqual("test");
    });

    test("should edit that filter", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.updateFilter(filter.id, {
            title: "New Filter",
            context: ["notifications"],
            filter_action: "hide",
            expires_in: 86400,
            keywords_attributes: [
                {
                    id: filter.keywords[0].id,
                    keyword: "new",
                    whole_word: false,
                },
            ],
        });

        expect(ok).toBe(true);
        expect(data).toBeObject();
        expect(data).toContainKeys(["id", "title"]);
        expect(data.title).toBe("New Filter");
        expect(data.context).toEqual(["notifications"]);
        expect(data.filter_action).toBe("hide");
        expect(data.expires_at).toBeString();
        expect(data.keywords).toBeArray();
        expect(data.keywords).not.toBeEmpty();
        expect(data.keywords[0]).toContainKeys(["keyword", "whole_word"]);
        expect(data.keywords[0].keyword).toEqual("new");
    });

    test("should delete keyword", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.updateFilter(filter.id, {
            keywords_attributes: [
                // biome-ignore lint/style/useNamingConvention: _destroy is a Mastodon API imposed variable name
                { id: filter.keywords[0].id, _destroy: true },
            ],
        });

        expect(ok).toBe(true);
        expect(data).toBeObject();
        expect(data).toContainKeys(["id", "title"]);
        expect(data.title).toBe("New Filter");

        // Get the filter again and check that the keyword is deleted
        const { data: data2, ok: ok2 } = await client.getFilter(filter.id);

        expect(ok2).toBe(true);
        expect(data2.keywords).toBeArray();
        expect(data2.keywords).toBeEmpty();
    });

    test("should delete filter", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.deleteFilter(filter.id);

        expect(ok).toBe(true);

        // Try to GET the filter again
        const { ok: ok2, raw } = await client.getFilter(filter.id);

        expect(ok2).toBe(false);
        expect(raw.status).toBe(404);
    });
});
