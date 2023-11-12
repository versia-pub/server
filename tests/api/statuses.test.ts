/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConfig } from "@config";
import { Token } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { client } from "~database/datasource";
import { TokenType } from "~database/entities/Token";
import { UserWithRelations, createNewLocalUser } from "~database/entities/User";
import { APIAccount } from "~types/entities/account";
import { APIContext } from "~types/entities/context";
import { APIStatus } from "~types/entities/status";

const config = getConfig();

let token: Token;
let user: UserWithRelations;
let status: APIStatus | null = null;
let status2: APIStatus | null = null;

describe("API Tests", () => {
	beforeAll(async () => {
		user = await createNewLocalUser({
			email: "test@test.com",
			username: "test",
			password: "test",
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

	describe("POST /api/v1/statuses", () => {
		test("should create a new status and return an APIStatus object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/statuses`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						status: "Hello, world!",
						visibility: "public",
					}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			status = (await response.json()) as APIStatus;
			expect(status.content).toBe("Hello, world!");
			expect(status.visibility).toBe("public");
			expect(status.account.id).toBe(user.id);
			expect(status.replies_count).toBe(0);
			expect(status.favourites_count).toBe(0);
			expect(status.reblogged).toBe(false);
			expect(status.favourited).toBe(false);
			expect(status.media_attachments).toEqual([]);
			expect(status.mentions).toEqual([]);
			expect(status.tags).toEqual([]);
			expect(status.sensitive).toBe(false);
			expect(status.spoiler_text).toBe("");
			expect(status.language).toBeNull();
			expect(status.pinned).toBe(false);
			expect(status.visibility).toBe("public");
			expect(status.card).toBeNull();
			expect(status.poll).toBeNull();
			expect(status.emojis).toEqual([]);
			expect(status.in_reply_to_id).toBeNull();
			expect(status.in_reply_to_account_id).toBeNull();
		});

		test("should create a new status in reply to the previous one", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/statuses`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						status: "This is a reply!",
						visibility: "public",
						in_reply_to_id: status?.id,
					}),
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			status2 = (await response.json()) as APIStatus;
			expect(status2.content).toBe("This is a reply!");
			expect(status2.visibility).toBe("public");
			expect(status2.account.id).toBe(user.id);
			expect(status2.replies_count).toBe(0);
			expect(status2.favourites_count).toBe(0);
			expect(status2.reblogged).toBe(false);
			expect(status2.favourited).toBe(false);
			expect(status2.media_attachments).toEqual([]);
			expect(status2.mentions).toEqual([]);
			expect(status2.tags).toEqual([]);
			expect(status2.sensitive).toBe(false);
			expect(status2.spoiler_text).toBe("");
			expect(status2.language).toBeNull();
			expect(status2.pinned).toBe(false);
			expect(status2.visibility).toBe("public");
			expect(status2.card).toBeNull();
			expect(status2.poll).toBeNull();
			expect(status2.emojis).toEqual([]);
			expect(status2.in_reply_to_id).toEqual(status?.id || null);
			expect(status2.in_reply_to_account_id).toEqual(user.id);
		});
	});

	describe("GET /api/v1/statuses/:id", () => {
		test("should return the specified status object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/statuses/${status?.id}`,
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

			const statusJson = (await response.json()) as APIStatus;

			expect(statusJson.id).toBe(status?.id || "");
			expect(statusJson.content).toBeDefined();
			expect(statusJson.created_at).toBeDefined();
			expect(statusJson.account).toBeDefined();
			expect(statusJson.reblog).toBeDefined();
			expect(statusJson.application).toBeDefined();
			expect(statusJson.emojis).toBeDefined();
			expect(statusJson.media_attachments).toBeDefined();
			expect(statusJson.poll).toBeDefined();
			expect(statusJson.card).toBeDefined();
			expect(statusJson.visibility).toBeDefined();
			expect(statusJson.sensitive).toBeDefined();
			expect(statusJson.spoiler_text).toBeDefined();
			expect(statusJson.uri).toBeDefined();
			expect(statusJson.url).toBeDefined();
			expect(statusJson.replies_count).toBeDefined();
			expect(statusJson.reblogs_count).toBeDefined();
			expect(statusJson.favourites_count).toBeDefined();
			expect(statusJson.favourited).toBeDefined();
			expect(statusJson.reblogged).toBeDefined();
			expect(statusJson.muted).toBeDefined();
			expect(statusJson.bookmarked).toBeDefined();
			expect(statusJson.pinned).toBeDefined();
		});
	});

	describe("POST /api/v1/statuses/:id/reblog", () => {
		test("should reblog the specified status and return the reblogged status object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/statuses/${status?.id}/reblog`,
				{
					method: "POST",
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

			const rebloggedStatus = (await response.json()) as APIStatus;

			expect(rebloggedStatus.id).toBeDefined();
			expect(rebloggedStatus.reblog?.id).toEqual(status?.id ?? "");
			expect(rebloggedStatus.reblog?.reblogged).toBe(true);
		});
	});

	describe("POST /api/v1/statuses/:id/unreblog", () => {
		test("should unreblog the specified status and return the original status object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/statuses/${status?.id}/unreblog`,
				{
					method: "POST",
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

			const unrebloggedStatus = (await response.json()) as APIStatus;

			expect(unrebloggedStatus.id).toBeDefined();
			expect(unrebloggedStatus.reblogged).toBe(false);
		});
	});

	describe("GET /api/v1/statuses/:id/context", () => {
		test("should return the context of the specified status", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/statuses/${status?.id}/context`,
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

			const context = (await response.json()) as APIContext;

			expect(context.ancestors.length).toBe(0);
			expect(context.descendants.length).toBe(1);

			// First descendant should be status2
			expect(context.descendants[0].id).toBe(status2?.id || "");
		});
	});

	describe("GET /api/v1/timelines/public", () => {
		test("should return an array of APIStatus objects that includes the created status", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/timelines/public`,
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

			const statuses = (await response.json()) as APIStatus[];

			expect(statuses.some(s => s.id === status?.id)).toBe(true);
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

			expect(statuses.length).toBe(2);

			const status1 = statuses[1];

			// Basic validation
			expect(status1.content).toBe("This is a reply!");
			expect(status1.visibility).toBe("public");
			expect(status1.account.id).toBe(user.id);
		});
	});

	describe("POST /api/v1/statuses/:id/favourite", () => {
		test("should favourite the specified status object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/statuses/${status?.id}/favourite`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
					},
				}
			);

			expect(response.status).toBe(200);
		});
	});

	describe("GET /api/v1/statuses/:id/favourited_by", () => {
		test("should return an array of User objects who favourited the specified status", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/statuses/${status?.id}/favourited_by`,
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

			const users = (await response.json()) as APIAccount[];

			expect(users.length).toBe(1);
			expect(users[0].id).toBe(user.id);
		});
	});

	describe("POST /api/v1/statuses/:id/unfavourite", () => {
		test("should unfavourite the specified status object", async () => {
			// Unfavourite the status
			const response = await fetch(
				`${config.http.base_url}/api/v1/statuses/${status?.id}/unfavourite`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
					},
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const updatedStatus = (await response.json()) as APIStatus;

			expect(updatedStatus.favourited).toBe(false);
			expect(updatedStatus.favourites_count).toBe(0);
		});
	});

	describe("DELETE /api/v1/statuses/:id", () => {
		test("should delete the specified status object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/statuses/${status?.id}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token.access_token}`,
					},
				}
			);

			expect(response.status).toBe(200);
		});
	});
});
