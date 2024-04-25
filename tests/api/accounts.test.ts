import { afterAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { getTestUsers, sendTestRequest, wrapRelativeUrl } from "~tests/utils";
import type { Account as APIAccount } from "~types/mastodon/account";
import type { Relationship as APIRelationship } from "~types/mastodon/relationship";
import type { Status as APIStatus } from "~types/mastodon/status";

const base_url = config.http.base_url;

const { users, tokens, deleteUsers } = await getTestUsers(2);
const user = users[0];
const user2 = users[1];
const token = tokens[0];

afterAll(async () => {
    await deleteUsers();
});

describe("API Tests", () => {
    describe("PATCH /api/v1/accounts/update_credentials", () => {
        test("should update the authenticated user's display name", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        "/api/v1/accounts/update_credentials",
                        base_url,
                    ),
                    {
                        method: "PATCH",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            display_name: "New Display Name",
                        }),
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const user = (await response.json()) as APIAccount;

            expect(user.display_name).toBe("New Display Name");
        });
    });

    describe("GET /api/v1/accounts/verify_credentials", () => {
        test("should return the authenticated user's account information", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        "/api/v1/accounts/verify_credentials",
                        base_url,
                    ),
                    {
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const account = (await response.json()) as APIAccount;

            expect(account.username).toBe(user.getUser().username);
            expect(account.bot).toBe(false);
            expect(account.locked).toBe(false);
            expect(account.created_at).toBeDefined();
            expect(account.followers_count).toBe(0);
            expect(account.following_count).toBe(0);
            expect(account.statuses_count).toBe(0);
            expect(account.note).toBe("");
            expect(account.url).toBe(
                new URL(
                    `/@${user.getUser().username}`,
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
            expect(account.source?.language).toBeNull();
            expect(account.source?.note).toBe("");
            expect(account.source?.sensitive).toBe(false);
        });
    });

    describe("GET /api/v1/accounts/:id/statuses", () => {
        test("should return the statuses of the specified user", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `/api/v1/accounts/${user.id}/statuses`,
                        base_url,
                    ),
                    {
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const statuses = (await response.json()) as APIStatus[];

            expect(statuses.length).toBe(0);
        });
    });

    describe("POST /api/v1/accounts/:id/remove_from_followers", () => {
        test("should remove the specified user from the authenticated user's followers and return an APIRelationship object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `/api/v1/accounts/${user2.id}/remove_from_followers`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({}),
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const account = (await response.json()) as APIRelationship;

            expect(account.id).toBe(user2.id);
            expect(account.followed_by).toBe(false);
        });
    });

    describe("POST /api/v1/accounts/:id/block", () => {
        test("should block the specified user and return an APIRelationship object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `/api/v1/accounts/${user2.id}/block`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({}),
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const account = (await response.json()) as APIRelationship;

            expect(account.id).toBe(user2.id);
            expect(account.blocking).toBe(true);
        });
    });

    describe("GET /api/v1/blocks", () => {
        test("should return an array of APIAccount objects for the user's blocked accounts", async () => {
            const response = await sendTestRequest(
                new Request(wrapRelativeUrl("/api/v1/blocks", base_url), {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token.accessToken}`,
                    },
                }),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );
            const body = (await response.json()) as APIAccount[];

            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBe(1);
            expect(body[0].id).toBe(user2.id);
        });
    });

    describe("POST /api/v1/accounts/:id/unblock", () => {
        test("should unblock the specified user and return an APIRelationship object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `/api/v1/accounts/${user2.id}/unblock`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({}),
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const account = (await response.json()) as APIRelationship;

            expect(account.id).toBe(user2.id);
            expect(account.blocking).toBe(false);
        });
    });

    describe("POST /api/v1/accounts/:id/pin", () => {
        test("should pin the specified user and return an APIRelationship object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `/api/v1/accounts/${user2.id}/pin`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({}),
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const account = (await response.json()) as APIRelationship;

            expect(account.id).toBe(user2.id);
            expect(account.endorsed).toBe(true);
        });
    });

    describe("POST /api/v1/accounts/:id/unpin", () => {
        test("should unpin the specified user and return an APIRelationship object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `/api/v1/accounts/${user2.id}/unpin`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({}),
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const account = (await response.json()) as APIRelationship;

            expect(account.id).toBe(user2.id);
            expect(account.endorsed).toBe(false);
        });
    });

    describe("POST /api/v1/accounts/:id/note", () => {
        test("should update the specified account's note and return the updated account object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `/api/v1/accounts/${user2.id}/note`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ comment: "This is a new note" }),
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const account = (await response.json()) as APIAccount;

            expect(account.id).toBe(user2.id);
            expect(account.note).toBe("This is a new note");
        });
    });

    describe("GET /api/v1/accounts/relationships", () => {
        test("should return an array of APIRelationship objects for the authenticated user's relationships", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `/api/v1/accounts/relationships?id[]=${user2.id}`,
                        base_url,
                    ),
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const relationships = (await response.json()) as APIRelationship[];

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
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl("/api/v1/profile/avatar", base_url),
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const account = (await response.json()) as APIAccount;

            expect(account.id).toBeDefined();
            expect(account.avatar).toBeDefined();
        });
    });

    describe("DELETE /api/v1/profile/header", () => {
        test("should delete the header of the authenticated user and return the updated account object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl("/api/v1/profile/header", base_url),
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const account = (await response.json()) as APIAccount;

            expect(account.id).toBeDefined();
            expect(account.header).toBe("");
        });
    });

    describe("GET /api/v1/accounts/familiar_followers", () => {
        test("should follow the user", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `/api/v1/accounts/${user2.id}/follow`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({}),
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );
        });

        test("should return an array of objects with id and accounts properties, where id is a string and accounts is an array of APIAccount objects", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `/api/v1/accounts/familiar_followers?id[]=${user2.id}`,
                        base_url,
                    ),
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const familiarFollowers = (await response.json()) as {
                id: string;
                accounts: APIAccount[];
            }[];

            expect(Array.isArray(familiarFollowers)).toBe(true);
            expect(familiarFollowers.length).toBe(0);
        });
    });
});
