import { afterAll, describe, expect, test } from "bun:test";
import { fakeRequest, getTestUsers } from "~/tests/utils";
import { meta } from "./index";

const { tokens, deleteUsers } = await getTestUsers(2);

const response = await fakeRequest("/api/v2/filters", {
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

const filter = await response.json();
expect(filter).toBeObject();

afterAll(async () => {
    await deleteUsers();
});

// /api/v2/filters/:id
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", filter.id),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            },
        );

        expect(response.status).toBe(401);
    });

    test("should get that filter", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", filter.id),
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            },
        );

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

    test("should edit that filter", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", filter.id),
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    title: "New Filter",
                    "context[]": "notifications",
                    filter_action: "hide",
                    expires_in: "86400",
                    "keywords_attributes[0][keyword]": "new",
                    "keywords_attributes[0][id]": filter.keywords[0].id,
                    "keywords_attributes[0][whole_word]": "false",
                }),
            },
        );

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toBeObject();
        expect(json).toContainKeys(["id", "title"]);
        expect(json.title).toBe("New Filter");
        expect(json.context).toEqual(["notifications"]);
        expect(json.filter_action).toBe("hide");
        expect(json.expires_at).toBeString();
        expect(json.keywords).toBeArray();
        expect(json.keywords).not.toBeEmpty();
        expect(json.keywords[0]).toContainKeys(["keyword", "whole_word"]);
        expect(json.keywords[0].keyword).toEqual("new");
    });

    test("should delete keyword", async () => {
        const response = await fakeRequest(
            meta.route.replace(":id", filter.id),
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    "keywords_attributes[0][id]": filter.keywords[0].id,
                    "keywords_attributes[0][_destroy]": "true",
                }),
            },
        );

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toBeObject();
        expect(json.keywords).toBeEmpty();

        // Get the filter again and check
        const getResponse = await fakeRequest(
            meta.route.replace(":id", filter.id),
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            },
        );

        expect(getResponse.status).toBe(200);
        expect((await getResponse.json()).keywords).toBeEmpty();
    });

    test("should delete filter", async () => {
        const formData = new FormData();

        const response = await fakeRequest(
            meta.route.replace(":id", filter.id),
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: formData,
            },
        );

        expect(response.status).toBe(204);

        // Try to GET the filter again
        const getResponse = await fakeRequest(
            meta.route.replace(":id", filter.id),
            {
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            },
        );

        expect(getResponse.status).toBe(404);
    });
});
