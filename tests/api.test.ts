/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConfig } from "@config";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppDataSource } from "~database/datasource";
import { Application } from "~database/entities/Application";
import { Emoji } from "~database/entities/Emoji";
import { RawActivity } from "~database/entities/RawActivity";
import { Token, TokenType } from "~database/entities/Token";
import { User } from "~database/entities/User";
import { APIEmoji } from "~types/entities/emoji";
import { APIInstance } from "~types/entities/instance";

const config = getConfig();

let token: Token;
let user: User;
let user2: User;

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

	describe("GET /api/v1/instance", () => {
		test("should return an APIInstance object", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/instance`,
				{
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
				}
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json"
			);

			const instance = (await response.json()) as APIInstance;

			expect(instance.uri).toBe(new URL(config.http.base_url).hostname);
			expect(instance.title).toBeDefined();
			expect(instance.description).toBeDefined();
			expect(instance.email).toBeDefined();
			expect(instance.version).toBeDefined();
			expect(instance.urls).toBeDefined();
			expect(instance.stats).toBeDefined();
			expect(instance.thumbnail).toBeDefined();
			expect(instance.languages).toBeDefined();
			// Not implemented yet
			// expect(instance.contact_account).toBeDefined();
			expect(instance.rules).toBeDefined();
			expect(instance.approval_required).toBeDefined();
			expect(instance.max_toot_chars).toBeDefined();
		});
	});

	describe("GET /api/v1/custom_emojis", () => {
		beforeAll(async () => {
			const emoji = new Emoji();

			emoji.instance = null;
			emoji.url = "https://example.com";
			emoji.shortcode = "test";
			emoji.visible_in_picker = true;

			await emoji.save();
		});
		test("should return an array of at least one custom emoji", async () => {
			const response = await fetch(
				`${config.http.base_url}/api/v1/custom_emojis`,
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

			const emojis = (await response.json()) as APIEmoji[];

			expect(emojis.length).toBeGreaterThan(0);
			expect(emojis[0].shortcode).toBe("test");
			expect(emojis[0].url).toBe("https://example.com");
		});
		afterAll(async () => {
			await Emoji.delete({ shortcode: "test" });
		});
	});
});
