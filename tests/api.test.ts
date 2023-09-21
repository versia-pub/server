/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConfig } from "@config";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppDataSource } from "~database/datasource";
import { Application } from "~database/entities/Application";
import { RawActivity } from "~database/entities/RawActivity";
import { Token, TokenType } from "~database/entities/Token";
import { User } from "~database/entities/User";
import { APIAccount } from "~types/entities/account";
import { APIStatus } from "~types/entities/status";

const config = getConfig();

let token: Token;
let user: User;

beforeAll(async () => {
	if (!AppDataSource.isInitialized) await AppDataSource.initialize();

	// Initialize test user
	user = await User.createNew({
		email: "test@test.com",
		username: "test",
		password: "test",
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

	await token.save();
});

describe("POST /api/v1/accounts/:id", () => {
	test("should return a 404 error when trying to update a non-existent user", async () => {
		const response = await fetch(
			`${config.http.base_url}:${config.http.port}/api/v1/accounts/999999`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${token.access_token}`,
					"Content-Type": "application/json",
				},
			}
		);

		expect(response.status).toBe(404);
		expect(response.headers.get("content-type")).toBe("application/json");
	});
});

describe("POST /api/v1/statuses", () => {
	test("should create a new status and return an APIStatus object", async () => {
		const response = await fetch(
			`${config.http.base_url}:${config.http.port}/api/v1/statuses`,
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
		expect(response.headers.get("content-type")).toBe("application/json");

		const status: APIStatus = await response.json();

		expect(status.content).toBe("Hello, world!");
		expect(status.visibility).toBe("public");
		expect(status.account.id).toBe(
			`${config.http.base_url}:${config.http.port}/@test`
		);
		expect(status.replies_count).toBe(0);
		expect(status.favourites_count).toBe(0);
		expect(status.reblogged).toBe(false);
		expect(status.favourited).toBe(false);
		expect(status.reblog?.content).toBe("Hello, world!");
		expect(status.reblog?.visibility).toBe("public");
		expect(status.reblog?.account.id).toBe(
			`${config.http.base_url}:${config.http.port}/@test`
		);
		expect(status.reblog?.replies_count).toBe(0);
		expect(status.reblog?.favourites_count).toBe(0);
		expect(status.reblog?.reblogged).toBe(false);
		expect(status.reblog?.favourited).toBe(false);
		expect(status.media_attachments).toEqual([]);
		expect(status.mentions).toEqual([]);
		expect(status.tags).toEqual([]);
		expect(status.application).toBeNull();
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
		expect(status.reblog?.in_reply_to_id).toBeNull();
		expect(status.reblog?.in_reply_to_account_id).toBeNull();
	});
});

describe("POST /api/v1/accounts/update_credentials", () => {
	test("should update the authenticated user's display name", async () => {
		const response = await fetch(
			`${config.http.base_url}:${config.http.port}/api/v1/accounts/update_credentials`,
			{
				method: "POST",
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
		expect(response.headers.get("content-type")).toBe("application/json");

		const user: APIAccount = await response.json();

		expect(user.display_name).toBe("New Display Name");
	});
});

afterAll(async () => {
	// Clean up user
	const user = await User.findOneBy({
		username: "test",
	});

	// Clean up tokens
	const tokens = await Token.findBy({
		user: {
			username: "test",
		},
	});

	const activities = await RawActivity.createQueryBuilder("activity")
		.where("activity.data->>'actor' = :actor", {
			actor: `${config.http.base_url}:${config.http.port}/@test`,
		})
		.leftJoinAndSelect("activity.objects", "objects")
		.getMany();

	// Delete all created objects and activities as part of testing
	await Promise.all(
		activities.map(async activity => {
			await Promise.all(
				activity.objects.map(async object => await object.remove())
			);
			await activity.remove();
		})
	);

	await Promise.all(tokens.map(async token => await token.remove()));

	if (user) await user.remove();
});
