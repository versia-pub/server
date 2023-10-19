import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { AppDataSource } from "~database/datasource";
import { Instance } from "~database/entities/Instance";

let instance: Instance;

beforeAll(async () => {
	if (!AppDataSource.isInitialized) await AppDataSource.initialize();
});

describe("Instance", () => {
	it("should add an instance to the database if it doesn't already exist", async () => {
		const url = "https://mastodon.social";
		instance = await Instance.addIfNotExists(url);
		expect(instance.base_url).toBe("mastodon.social");
	});

	it("should convert the instance to an API instance", async () => {
		const apiInstance = await instance.toAPI();
		expect(apiInstance.uri).toBe("mastodon.social");
		expect(apiInstance.approval_required).toBe(false);
		expect(apiInstance.email).toBe("staff@mastodon.social");
		expect(apiInstance.thumbnail).toBeDefined();
		expect(apiInstance.title).toBeDefined();
		expect(apiInstance.configuration).toBeDefined();
		expect(apiInstance.contact_account).toBeDefined();
		expect(apiInstance.description).toBeDefined();
		expect(apiInstance.invites_enabled).toBeDefined();
		expect(apiInstance.languages).toBeDefined();
		expect(apiInstance.registrations).toBeDefined();
		expect(apiInstance.rules).toBeDefined();
		expect(apiInstance.stats).toBeDefined();
		expect(apiInstance.urls).toBeDefined();
		expect(apiInstance.max_toot_chars).toBeDefined();
	});
});

afterAll(async () => {
	await instance.remove();

	await AppDataSource.destroy();
});
