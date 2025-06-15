import { env, file } from "bun";
import chalk from "chalk";
import { parseTOML } from "confbox";
import type { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ConfigSchema } from "./schema.ts";

const CONFIG_LOCATION = env.CONFIG_LOCATION ?? "./config/config.toml";
const configFile = file(CONFIG_LOCATION);

if (!(await configFile.exists())) {
    throw new Error(
        `config file at "${CONFIG_LOCATION}" does not exist or is not accessible.`,
    );
}

const configText = await configFile.text();
const config = await parseTOML<z.infer<typeof ConfigSchema>>(configText);

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

export { ProxiableUrl } from "./url.ts";
export { exportedConfig as config };
