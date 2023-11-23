/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConfig } from "@config";
import type { Token } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { client } from "~database/datasource";
import { TokenType } from "~database/entities/Token";
import {
	type UserWithRelations,
	createNewLocalUser,
} from "~database/entities/User";
import type { APIAccount } from "~types/entities/account";
import type { APIRelationship } from "~types/entities/relationship";
import type { APIStatus } from "~types/entities/status";

const config = getConfig();

let token: Token;
let user: UserWithRelations;
let user2: UserWithRelations;

describe("API Tests", () => {
	beforeAll(async () => {
		user = await createNewLocalUser({
			email: "test@test.com",
			username: "test",
			password: "test",
			display_name: "",
		});

		user2 = await createNewLocalUser({
			email: "test2@test.com",
			username: "test2",
			password: "test2",
			display_name: "",
		});

		token = await client.token.create({
			data: {
				access_token: "test",
				application: {
					create: {
						client_id: "test",
						name: "Test Application",
						redirect_uris: "https://example.com",
						scopes: "read write",
						secret: "test",
						website: "https://example.com",
						vapid_key: null,
					},
				},
				code: "test",
				scope: "read write",
				token_type: TokenType.BEARER,
				user: {
					connect: {
						id: user.id,
					},
				},
			},
		});
	});

	afterAll(async () => {
		await client.user.deleteMany({
			where: {
				username: {
					in: ["test", "test2"],
				},
			},
		});
	});

	describe("POST /api/v1/accounts/:id", () => {
		test("should return a 404 error when trying to fetch a non-existent user", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/999999`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
				}
			);

			expect(response.status).toBe(404);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);
		});
	});

	describe("PATCH /api/v1/accounts/update_credentials", () => {
		test("should update the authenticated user's display name", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/update_credentials`,
				{
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						display_name: "New Display Name",
					}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const user = (await response.json()) as APIAccount;

			expect(user.display_name).toBe("New Display Name");
		});
	});

	describe("GET /api/v1/accounts/verify_credentials", () => {
		test("should return the authenticated user's account information", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/verify_credentials`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIAccount;

			expect(account.username).toBe(user.username);
			expect(account.bot).toBe(false);
			expect(account.locked).toBe(false);
			expect(account.created_at).toBeDefined();
			expect(account.followers_count).toBe(0);
			expect(account.following_count).toBe(0);
			expect(account.statuses_count).toBe(0);
			expect(account.note).toBe("");
			expect(account.url).toBe(
				`${config.http.base_url}/users/${user.id}`
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
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user.id}/statuses`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const statuses = (await response.json()) as APIStatus[];

			expect(statuses.length).toBe(0);
		});
	});

	describe("POST /api/v1/accounts/:id/follow", () => {
		test("should follow the specified user and return an APIRelationship object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/follow`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const relationship = (await response.json()) as APIRelationship;

			expect(relationship.id).toBe(user2.id);
			expect(relationship.following).toBe(true);
		});
	});

	describe("POST /api/v1/accounts/:id/unfollow", () => {
		test("should unfollow the specified user and return an APIRelationship object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/unfollow`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIRelationship;

			expect(account.id).toBe(user2.id);
			expect(account.following).toBe(false);
		});
	});

	describe("POST /api/v1/accounts/:id/remove_from_followers", () => {
		test("should remove the specified user from the authenticated user's followers and return an APIRelationship object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/remove_from_followers`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIRelationship;

			expect(account.id).toBe(user2.id);
			expect(account.followed_by).toBe(false);
		});
	});

	describe("POST /api/v1/accounts/:id/block", () => {
		test("should block the specified user and return an APIRelationship object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/block`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIRelationship;

			expect(account.id).toBe(user2.id);
			expect(account.blocking).toBe(true);
		});
	});

	describe("POST /api/v1/accounts/:id/unblock", () => {
		test("should unblock the specified user and return an APIRelationship object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/unblock`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIRelationship;

			expect(account.id).toBe(user2.id);
			expect(account.blocking).toBe(false);
		});
	});

	describe("POST /api/v1/accounts/:id/mute with notifications parameter", () => {
		test("should mute the specified user and return an APIRelationship object with notifications set to false", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/mute`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ notifications: true }),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIRelationship;

			expect(account.id).toBe(user2.id);
			expect(account.muting).toBe(true);
			expect(account.muting_notifications).toBe(true);
		});

		test("should mute the specified user and return an APIRelationship object with notifications set to true", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/mute`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ notifications: false }),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIRelationship;

			expect(account.id).toBe(user2.id);
			expect(account.muting).toBe(true);
			expect(account.muting_notifications).toBe(true);
		});
	});

	describe("POST /api/v1/accounts/:id/unmute", () => {
		test("should unmute the specified user and return an APIRelationship object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/unmute`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIRelationship;

			expect(account.id).toBe(user2.id);
			expect(account.muting).toBe(false);
		});
	});

	describe("POST /api/v1/accounts/:id/pin", () => {
		test("should pin the specified user and return an APIRelationship object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/pin`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIRelationship;

			expect(account.id).toBe(user2.id);
			expect(account.endorsed).toBe(true);
		});
	});

	describe("POST /api/v1/accounts/:id/unpin", () => {
		test("should unpin the specified user and return an APIRelationship object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/unpin`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIRelationship;

			expect(account.id).toBe(user2.id);
			expect(account.endorsed).toBe(false);
		});
	});

	describe("POST /api/v1/accounts/:id/note", () => {
		test("should update the specified account's note and return the updated account object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/note`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ comment: "This is a new note" }),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIAccount;

			expect(account.id).toBe(user2.id);
			expect(account.note).toBe("This is a new note");
		});
	});

	describe("GET /api/v1/accounts/relationships", () => {
		test("should return an array of APIRelationship objects for the authenticated user's relationships", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/relationships?id[]=${user2.id}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
					},
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
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
			const response = await fetch(
				`${config.http.base_url}/api/v1/profile/avatar`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIAccount;

			expect(account.id).toBeDefined();
			expect(account.avatar).toBe("");
		});
	});

	describe("DELETE /api/v1/profile/header", () => {
		test("should delete the header of the authenticated user and return the updated account object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/profile/header`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const account = (await response.json()) as APIAccount;

			expect(account.id).toBeDefined();
			expect(account.header).toBe("");
		});
	});

	describe("GET /api/v1/accounts/familiar_followers", () => {
		test("should follow the user", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/${user2.id}/follow`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);
		});

		test("should return an array of objects with id and accounts properties, where id is a string and accounts is an array of APIAccount objects", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/accounts/familiar_followers?id[]=${user2.id}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
					},
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const familiarFollowers = (await response.json()) as {
				id: string;
				accounts: APIAccount[];
			}[];

			expect(Array.isArray(familiarFollowers)).toBe(true);
			expect(familiarFollowers.length).toBe(0);
			/* expect(typeof familiarFollowers[0].id).toBe("string");
			expect(Array.isArray(familiarFollowers[0].accounts)).toBe(true);
			expect(familiarFollowers[0].accounts.length).toBeGreaterThanOrEqual(
				0
			);

			if (familiarFollowers[0].accounts.length === 0) return;
			expect(familiarFollowers[0].accounts[0].id).toBeDefined();
			expect(familiarFollowers[0].accounts[0].username).toBeDefined();
			expect(familiarFollowers[0].accounts[0].acct).toBeDefined();
			expect(familiarFollowers[0].accounts[0].display_name).toBeDefined();
			expect(familiarFollowers[0].accounts[0].locked).toBeDefined();
			expect(familiarFollowers[0].accounts[0].bot).toBeDefined();
			expect(familiarFollowers[0].accounts[0].discoverable).toBeDefined();
			expect(familiarFollowers[0].accounts[0].group).toBeDefined();
			expect(familiarFollowers[0].accounts[0].created_at).toBeDefined();
			expect(familiarFollowers[0].accounts[0].note).toBeDefined();
			expect(familiarFollowers[0].accounts[0].url).toBeDefined();
			expect(familiarFollowers[0].accounts[0].avatar).toBeDefined();
			expect(
				familiarFollowers[0].accounts[0].avatar_static
			).toBeDefined();
			expect(familiarFollowers[0].accounts[0].header).toBeDefined();
			expect(
				familiarFollowers[0].accounts[0].header_static
			).toBeDefined();
			expect(
				familiarFollowers[0].accounts[0].followers_count
			).toBeDefined();
			expect(
				familiarFollowers[0].accounts[0].following_count
			).toBeDefined();
			expect(
				familiarFollowers[0].accounts[0].statuses_count
			).toBeDefined();
			expect(familiarFollowers[0].accounts[0].emojis).toBeDefined();
			expect(familiarFollowers[0].accounts[0].fields).toBeDefined(); */
		});
	});
});
