import { getConfig } from "@config";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppDataSource } from "~database/datasource";
import { Application } from "~database/entities/Application";
import { Token } from "~database/entities/Token";
import { User } from "~database/entities/User";

const config = getConfig();

let client_id: string;
let client_secret: string;
let code: string;
let token: Token;

beforeAll(async () => {
	if (!AppDataSource.isInitialized) await AppDataSource.initialize();

	// Initialize test user
	await User.createNewLocal({
		email: "test@test.com",
		username: "test",
		password: "test",
		display_name: "",
	});
});

describe("POST /api/v1/apps/", () => {
	test("should create an application", async () => {
		const formData = new FormData();

		formData.append("client_name", "Test Application");
		formData.append("website", "https://example.com");
		formData.append("redirect_uris", "https://example.com");
		formData.append("scopes", "read write");

		const response = await fetch(`${config.http.base_url}/api/v1/apps/`, {
			method: "POST",
			body: formData,
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/json");

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const json = await response.json();

		expect(json).toEqual({
			id: expect.any(String),
			name: "Test Application",
			website: "https://example.com",
			client_id: expect.any(String),
			client_secret: expect.any(String),
			redirect_uri: "https://example.com",
			vapid_link: null,
		});

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		client_id = json.client_id;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		client_secret = json.client_secret;
	});
});

describe("POST /auth/login/", () => {
	test("should get a code", async () => {
		const formData = new FormData();

		formData.append("email", "test@test.com");
		formData.append("password", "test");
		const response = await fetch(
			`${config.http.base_url}/auth/login/?client_id=${client_id}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
			{
				method: "POST",
				body: formData,
				redirect: "manual",
			}
		);
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toMatch(
			/https:\/\/example.com\?code=/
		);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		code = response.headers.get("location")?.split("=")[1] || "";
	});
});

describe("POST /oauth/token/", () => {
	test("should get an access token", async () => {
		const formData = new FormData();

		formData.append("grant_type", "authorization_code");
		formData.append("code", code);
		formData.append("redirect_uri", "https://example.com");
		formData.append("client_id", client_id);
		formData.append("client_secret", client_secret);
		formData.append("scope", "read+write");

		const response = await fetch(`${config.http.base_url}/oauth/token/`, {
			method: "POST",
			body: formData,
		});

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/json");
		expect(json).toEqual({
			access_token: expect.any(String),
			token_type: "Bearer",
			scope: "read write",
			created_at: expect.any(String),
		});

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		token = json;
	});
});

describe("GET /api/v1/apps/verify_credentials", () => {
	test("should return the authenticated application's credentials", async () => {
		const response = await fetch(
			`${config.http.base_url}/api/v1/apps/verify_credentials`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${token.access_token}`,
					"Content-Type": "application/json",
				},
			}
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/json");

		const credentials: Partial<Application> = await response.json();

		expect(credentials.name).toBe("Test Application");
		expect(credentials.website).toBe("https://example.com");
		expect(credentials.redirect_uris).toBe("https://example.com");
		expect(credentials.scopes).toBe("read write");
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

	const applications = await Application.findBy({
		client_id,
		secret: client_secret,
	});

	await Promise.all(tokens.map(async token => await token.remove()));
	await Promise.all(
		applications.map(async application => await application.remove())
	);

	if (user) await user.remove();
});
