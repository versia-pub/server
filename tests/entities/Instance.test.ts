/* import { afterAll, beforeAll, describe, expect, it } from "bun:test";
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
});

afterAll(async () => {
	await instance.remove();

	await AppDataSource.destroy();
});
 */
