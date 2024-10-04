import { afterAll, describe, expect, test } from "bun:test";
import { fakeRequest, getTestUsers } from "~/tests/utils";
import { meta } from "./index.ts";

const { tokens, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

// /api/v2/filters
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(meta.route);

        expect(response.status).toBe(401);
    });

    test("should return user filters (none)", async () => {
        const response = await fakeRequest(meta.route, {
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
            },
        });

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toBeArray();
        expect(json).toBeEmpty();
    });

    test("should create a new filter", async () => {
        const formData = new FormData();

        formData.append("title", "Test Filter");
        formData.append("context[]", "home");
        formData.append("filter_action", "warn");
        formData.append("expires_in", "86400");
        formData.append("keywords_attributes[0][keyword]", "test");
        formData.append("keywords_attributes[0][whole_word]", "true");

        const response = await fakeRequest(meta.route, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                title: "Test Filter",
                "context[]": "home",
                filter_action: "warn",
                expires_in: "86400",
                "keywords_attributes[0][keyword]": "test",
                "keywords_attributes[0][whole_word]": "true",
            }),
        });

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toBeObject();
        expect(json).toContainKeys(["id", "title"]);
        expect(json.title).toBe("Test Filter");
        expect(json.context).toEqual(["home"]);
        expect(json.filter_action).toBe("warn");
        expect(json.expires_at).toBeString();
        expect(json.keywords).toBeArray();
        expect(json.keywords).not.toBeEmpty();
        expect(json.keywords[0]).toContainKeys(["keyword", "whole_word"]);
        expect(json.keywords[0].keyword).toEqual("test");
    });
});
