/**
 * @file config.ts
 * @summary Config system to retrieve and modify system configuration
 * @description Can read from a hand-written file, config.toml, or from a machine-saved file, config.internal.toml
 * Fuses both and provides a way to retrieve individual values
 */

import { file } from "bun";
import { loadConfig, watchConfig } from "c12";
import chalk from "chalk";
import type { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ConfigSchema } from "./classes/config/schema.ts";

if (!(await file("config/config.toml").exists())) {
    throw new Error("config.toml does not or is not accessible.");
}

const { config } = await watchConfig<z.infer<typeof ConfigSchema>>({
    configFile: "./config/config.toml",
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
        `⚠ Error encountered while loading ${chalk.gray("config.toml")}.`,
    );
    console.error(
        "⚠ This is due to invalid, missing or incorrect values in the configuration file.",
    );
    console.error(
        "⚠ Here is the error message, please fix the configuration file accordingly:",
    );
    const errorMessage = fromZodError(parsed.error).message;

    console.info(errorMessage);

    process.exit(1);
}

const exportedConfig = parsed.data;

export { exportedConfig as config };
