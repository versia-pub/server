// FILEPATH: /home/jessew/Dev/lysand/packages/config-manager/config-manager.test.ts
import { stringify } from "@iarna/toml";
import { ConfigManager } from "..";
import { describe, beforeEach, spyOn, it, expect } from "bun:test";

describe("ConfigManager", () => {
	let configManager: ConfigManager;

	beforeEach(() => {
		configManager = new ConfigManager({
			configPathOverride: "./config/config.toml",
			internalConfigPathOverride: "./config/config.internal.toml",
		});
	});

	it("should get the correct config path", () => {
		expect(configManager.getConfigPath()).toEqual("./config/config.toml");
	});

	it("should get the correct internal config path", () => {
		expect(configManager.getInternalConfigPath()).toEqual(
			"./config/config.internal.toml"
		);
	});

	it("should read the config file correctly", async () => {
		const mockConfig = { key: "value" };

		// @ts-expect-error This is a mock
		spyOn(Bun, "file").mockImplementationOnce(() => ({
			exists: () =>
				new Promise(resolve => {
					resolve(true);
				}),
			text: () =>
				new Promise(resolve => {
					resolve(stringify(mockConfig));
				}),
		}));

		const config = await configManager.getConfig<typeof mockConfig>();

		expect(config).toEqual(mockConfig);
	});

	it("should read the internal config file correctly", async () => {
		const mockConfig = { key: "value" };

		// @ts-expect-error This is a mock
		spyOn(Bun, "file").mockImplementationOnce(() => ({
			exists: () =>
				new Promise(resolve => {
					resolve(true);
				}),
			text: () =>
				new Promise(resolve => {
					resolve(stringify(mockConfig));
				}),
		}));

		const config =
			// @ts-expect-error Force call private function for testing
			await configManager.readInternalConfig<typeof mockConfig>();

		expect(config).toEqual(mockConfig);
	});

	it("should write to the internal config file correctly", async () => {
		const mockConfig = { key: "value" };

		spyOn(Bun, "write").mockImplementationOnce(
			() =>
				new Promise(resolve => {
					resolve(10);
				})
		);

		await configManager.writeConfig(mockConfig);
	});

	it("should merge configs correctly", () => {
		const config1 = { key1: "value1", key2: "value2" };
		const config2 = { key2: "newValue2", key3: "value3" };
		// @ts-expect-error Force call private function for testing
		const mergedConfig = configManager.mergeConfigs<Record<string, string>>(
			config1,
			config2
		);

		expect(mergedConfig).toEqual({
			key1: "value1",
			key2: "newValue2",
			key3: "value3",
		});
	});
});
