/**
 * @file index.ts
 * @summary ConfigManager system to retrieve and modify system configuration
 * @description Can read from a hand-written file, config.toml, or from a machine-saved file, config.internal.toml
 * Fuses both and provides a way to retrieve individual values
 */

import { watchConfig } from "c12";
import { defaultConfig, type Config } from "./config.type";

const { config } = await watchConfig<Config>({
	configFile: "./config/config.toml",
	defaultConfig: defaultConfig,
	overrides:
		(
			await watchConfig<Config>({
				configFile: "./config/config.internal.toml",
				defaultConfig: {} as Config,
			})
		).config ?? undefined,
});

const exportedConfig = config ?? defaultConfig;

export { exportedConfig as config };
export type { Config };
