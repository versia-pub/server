/**
 * @file index.ts
 * @summary ConfigManager system to retrieve and modify system configuration
 * @description Can read from a hand-written file, config.toml, or from a machine-saved file, config.internal.toml
 * Fuses both and provides a way to retrieve individual values
 */

import { loadConfig, watchConfig } from "c12";
import { fromZodError } from "zod-validation-error";
import { type Config, configValidator } from "./config.type";

const { config } = await watchConfig({
    configFile: "./config/config.toml",
    overrides:
        (
            await loadConfig<Config>({
                configFile: "./config/config.internal.toml",
            })
        ).config ?? undefined,
});

const parsed = await configValidator.safeParseAsync(config);

if (!parsed.success) {
    console.error("Invalid config file:");
    throw fromZodError(parsed.error).message;
}

const exportedConfig = parsed.data;

export { exportedConfig as config };
export type { Config };
