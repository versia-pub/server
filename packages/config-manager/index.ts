/**
 * @file index.ts
 * @summary ConfigManager system to retrieve and modify system configuration
 * @description Can read from a hand-written file, config.toml, or from a machine-saved file, config.internal.toml
 * Fuses both and provides a way to retrieve individual values
 */

import { loadConfig, watchConfig } from "c12";
import chalk from "chalk";
import { fromError } from "zod-validation-error";
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
    console.log(
        `${chalk.bgRed.white(
            " CRITICAL ",
        )} There was an error parsing the config file at ${chalk.bold(
            "./config/config.toml",
        )}. Please fix the file and try again.`,
    );
    console.log(
        `${chalk.bgRed.white(
            " CRITICAL ",
        )} Follow the installation intructions and get a sample config file from the repository if needed.`,
    );
    console.log(
        `${chalk.bgRed.white(" CRITICAL ")} ${fromError(parsed.error).message}`,
    );
    process.exit(1);
}

const exportedConfig = parsed.data;

export { exportedConfig as config };
export type { Config };
