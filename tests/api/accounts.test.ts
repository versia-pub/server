/**
 * @deprecated
 */
import { afterAll, describe, expect, test } from "bun:test";
import type { z } from "@hono/zod-openapi";
import type { Account, Relationship } from "@versia/client/schemas";
import { config } from "~/config.ts";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(2);
const user = users[0];
const user2 = users[1];
const token = tokens[0];

afterAll(async () => {
    await deleteUsers();
});

const getFormData = (
    object: Record<string, string | number | boolean>,
): FormData =>
    Object.keys(object).reduce((formData, key) => {
        formData.append(key, String(object[key]));
        return formData;
    }, new FormData());

describe("API Tests", () => {
    describe("PATCH /api/v1/accounts/update_credentials", () => {
        test("should update the authenticated user's display name", async () => {
            const response = await fakeRequest(
                "/api/v1/accounts/update_credentials",
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                    },
                    body: getFormData({
                        display_name: "New Display Name",
                    }),
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const user = (await response.json()) as z.infer<typeof Account>;

            expect(user.display_name).toBe("New Display Name");
        });
    });

    describe("GET /api/v1/accounts/verify_credentials", () => {
        test("should return the authenticated user's account information", async () => {
            const response = await fakeRequest(
                "/api/v1/accounts/verify_credentials",
                {
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                    },
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const account = (await response.json()) as z.infer<typeof Account>;

            expect(account.username).toBe(user.data.username);
            expect(account.bot).toBe(false);
            expect(account.locked).toBe(false);
            expect(account.created_at).toBeDefined();
            expect(account.followers_count).toBe(0);
            expect(account.following_count).toBe(0);
            expect(account.statuses_count).toBe(0);
            expect(account.note).toBe("");
            expect(account.url).toBe(
                new URL(
                    `/@${user.data.username}`,
                    config.http.base_url,
                ).toString(),
            );
            expect(account.avatar).toBeDefined();
            expect(account.avatar_static).toBeDefined();
            expect(account.header).toBeDefined();
            expect(account.header_static).toBeDefined();
            expect(account.emojis).toEqual([]);
            expect(account.fields).toEqual([]);
            expect(account.source?.fields).toEqual([]);
            expect(account.source?.privacy).toBe("public");
            expect(account.source?.language).toBe("en");
            expect(account.source?.note).toBe("");
            expect(account.source?.sensitive).toBe(false);
        });
    });

    describe("POST /api/v1/accounts/:id/remove_from_followers", () => {
        test("should remove the specified user from the authenticated user's followers and return an APIRelationship object", async () => {
            const response = await fakeRequest(
                `/api/v1/accounts/${user2.id}/remove_from_followers`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const account = (await response.json()) as z.infer<
                typeof Relationship
            >;

            expect(account.id).toBe(user2.id);
            expect(account.followed_by).toBe(false);
        });
    });

    describe("POST /api/v1/accounts/:id/block", () => {
        test("should block the specified user and return an APIRelationship object", async () => {
            const response = await fakeRequest(
                `/api/v1/accounts/${user2.id}/block`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const account = (await response.json()) as z.infer<
                typeof Relationship
            >;

            expect(account.id).toBe(user2.id);
            expect(account.blocking).toBe(true);
        });
    });

    describe("GET /api/v1/blocks", () => {
        test("should return an array of APIAccount objects for the user's blocked accounts", async () => {
            const response = await fakeRequest("/api/v1/blocks", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token.data.accessToken}`,
                },
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );
            const body = (await response.json()) as z.infer<typeof Account>[];

            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBe(1);
            expect(body[0].id).toBe(user2.id);
        });
    });

    describe("POST /api/v1/accounts/:id/unblock", () => {
        test("should unblock the specified user and return an APIRelationship object", async () => {
            const response = await fakeRequest(
                `/api/v1/accounts/${user2.id}/unblock`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const account = (await response.json()) as z.infer<
                typeof Relationship
            >;

            expect(account.id).toBe(user2.id);
            expect(account.blocking).toBe(false);
        });
    });

    describe("POST /api/v1/accounts/:id/pin", () => {
        test("should pin the specified user and return an APIRelationship object", async () => {
            const response = await fakeRequest(
                `/api/v1/accounts/${user2.id}/pin`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const account = (await response.json()) as z.infer<
                typeof Relationship
            >;

            expect(account.id).toBe(user2.id);
            expect(account.endorsed).toBe(true);
        });
    });

    describe("POST /api/v1/accounts/:id/unpin", () => {
        test("should unpin the specified user and return an APIRelationship object", async () => {
            const response = await fakeRequest(
                `/api/v1/accounts/${user2.id}/unpin`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const account = (await response.json()) as z.infer<
                typeof Relationship
            >;

            expect(account.id).toBe(user2.id);
            expect(account.endorsed).toBe(false);
        });
    });

    describe("POST /api/v1/accounts/:id/note", () => {
        test("should update the specified account's note and return the updated account object", async () => {
            const response = await fakeRequest(
                `/api/v1/accounts/${user2.id}/note`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ comment: "This is a new note" }),
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const account = (await response.json()) as z.infer<typeof Account>;

            expect(account.id).toBe(user2.id);
            expect(account.note).toBe("This is a new note");
        });
    });

    describe("GET /api/v1/accounts/relationships", () => {
        test("should return an array of APIRelationship objects for the authenticated user's relationships", async () => {
            const response = await fakeRequest(
                `/api/v1/accounts/relationships?id[]=${user2.id}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                    },
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const relationships = (await response.json()) as z.infer<
                typeof Relationship
            >[];

            expect(Array.isArray(relationships)).toBe(true);
            expect(relationships.length).toBeGreaterThan(0);
            expect(relationships[0].id).toBeDefined();
            expect(relationships[0].following).toBeDefined();
            expect(relationships[0].followed_by).toBeDefined();
            expect(relationships[0].blocking).toBeDefined();
            expect(relationships[0].muting).toBeDefined();
            expect(relationships[0].muting_notifications).toBeDefined();
            expect(relationships[0].requested).toBeDefined();
            expect(relationships[0].domain_blocking).toBeDefined();
            expect(relationships[0].notifying).toBeDefined();
        });
    });

    describe("DELETE /api/v1/profile/avatar", () => {
        test("should delete the avatar of the authenticated user and return the updated account object", async () => {
            const response = await fakeRequest("/api/v1/profile/avatar", {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token.data.accessToken}`,
                },
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const account = (await response.json()) as z.infer<typeof Account>;

            expect(account.id).toBeDefined();
            expect(account.avatar).toBeDefined();
        });
    });

    describe("DELETE /api/v1/profile/header", () => {
        test("should delete the header of the authenticated user and return the updated account object", async () => {
            const response = await fakeRequest("/api/v1/profile/header", {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token.data.accessToken}`,
                },
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const account = (await response.json()) as z.infer<typeof Account>;

            expect(account.id).toBeDefined();
            expect(account.header).toBe("");
        });
    });

    describe("GET /api/v1/accounts/familiar_followers", () => {
        test("should follow the user", async () => {
            const response = await fakeRequest(
                `/api/v1/accounts/${user2.id}/follow`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );
        });

        test("should return no familiar followers", async () => {
            const response = await fakeRequest(
                `/api/v1/accounts/familiar_followers?id[]=${user2.id}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token.data.accessToken}`,
                    },
                },
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );

            const familiarFollowers = (await response.json()) as {
                id: string;
                accounts: z.infer<typeof Account>[];
            }[];

            expect(Array.isArray(familiarFollowers)).toBe(true);
            expect(familiarFollowers.length).toBe(1);
            expect(familiarFollowers[0].id).toBe(user2.id);
            expect(familiarFollowers[0].accounts).toBeArrayOfSize(0);
        });
    });
});
