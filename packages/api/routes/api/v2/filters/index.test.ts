import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v2/filters", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getFilters();

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return user filters (none)", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getFilters();

        expect(ok).toBe(true);
        expect(data).toBeArrayOfSize(0);
    });

    test("should create a new filter", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.createFilter(
            ["home"],
            "Test Filter",
            "warn",
            {
                expires_in: 86400,
                keywords_attributes: [{ keyword: "test", whole_word: true }],
            },
        );

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
});
