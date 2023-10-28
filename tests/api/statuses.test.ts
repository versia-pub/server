/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConfig } from "@config";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppDataSource } from "~database/datasource";
import { Application } from "~database/entities/Application";
import { RawActivity } from "~database/entities/RawActivity";
import { Token, TokenType } from "~database/entities/Token";
import { User } from "~database/entities/User";
import { APIContext } from "~types/entities/context";
import { APIStatus } from "~types/entities/status";

const config = getConfig();

let token: Token;
let user: User;
let user2: User;
let status: APIStatus | null = null;
let status2: APIStatus | null = null;

describe("API Tests", () => {
	beforeAll(async () => {
		if (!AppDataSource.isInitialized) await AppDataSource.initialize();

		// Initialize test user
		user = await User.createNewLocal({
			email: "test@test.com",
			username: "test",
			password: "test",
			display_name: "",
		});

		// Initialize second test user
		user2 = await User.createNewLocal({
			email: "test2@test.com",
			username: "test2",
			password: "test2",
			display_name: "",
		});

		const app = new Application();

		app.name = "Test Application";
		app.website = "https://example.com";
		app.client_id = "test";
		app.redirect_uris = "https://example.com";
		app.scopes = "read write";
		app.secret = "test";
		app.vapid_key = null;

		await app.save();

		// Initialize test token
		token = new Token();

		token.access_token = "test";
		token.application = app;
		token.code = "test";
		token.scope = "read write";
		token.token_type = TokenType.BEARER;
		token.user = user;

		token = await token.save();
	});

	afterAll(async () => {
		const activities = await RawActivity.createQueryBuilder("activity")
			.where("activity.data->>'actor' = :actor", {
				actor: `${config.http.base_url}/users/test`,
			})
			.leftJoinAndSelect("activity.objects", "objects")
			.getMany();

		// Delete all created objects and activities as part of testing
		for (const activity of activities) {
			for (const object of activity.objects) {
				await object.remove();
			}
			await activity.remove();
		}

		await user.remove();
		await user2.remove();

		await AppDataSource.destroy();
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
			expect(status2.in_reply_to_id).toEqual(status?.id);
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

			expect(statusJson.id).toBe(status?.id);
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
			expect(context.descendants[0].id).toBe(status2?.id);
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
			expect(status1.content).toBe("Hello, world!");
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

			const users = (await response.json()) as User[];

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
