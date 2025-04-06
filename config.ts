/**
 * @file config.ts
 * @summary Config system to retrieve and modify system configuration
 * @description Can read from a hand-written file, config.toml, or from a machine-saved file, config.internal.toml
 * Fuses both and provides a way to retrieve individual values
 */

import { env, file } from "bun";
import { loadConfig, watchConfig } from "c12";
import chalk from "chalk";
import type { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ConfigSchema } from "./classes/config/schema.ts";

const CONFIG_LOCATION = env.CONFIG_LOCATION ?? "./config/config.toml";

if (!(await file(CONFIG_LOCATION).exists())) {
    throw new Error(
        `config file at "${CONFIG_LOCATION}" does not exist or is not accessible.`,
    );
}

const { config } = await watchConfig<z.infer<typeof ConfigSchema>>({
    configFile: CONFIG_LOCATION,
    overrides:
        (
            await loadConfig<z.infer<typeof ConfigSchema>>({
                configFile: "./config/config.internal.toml",
            })
        ).config ?? undefined,
});

const parsed = await ConfigSchema.safeParseAsync(config);

if (!parsed.success) {
    console.error(
        `⚠ Error encountered while loading ${chalk.gray(CONFIG_LOCATION)}.`,
    );
    console.error(
        "⚠ This is due to invalid, missing or incorrect values in the configuration file.",
    );
    console.error(
        "⚠ Here is the error message, please fix the configuration file accordingly:",
    );
    const errorMessage = fromZodError(parsed.error).message;

    console.info(errorMessage);

    throw new Error("Configuration file is invalid.");
}

const exportedConfig = parsed.data;

export { exportedConfig as config };
