import { readdir } from "node:fs/promises";
import { getLogger, type Logger } from "@logtape/logtape";
import { file, sleep } from "bun";
import chalk from "chalk";
import { parseJSON5, parseJSONC } from "confbox";
import type { Hono } from "hono";
import type { ZodTypeAny } from "zod";
import { fromZodError, type ValidationError } from "zod-validation-error";
import { config } from "~/config.ts";
import { Plugin } from "~/packages/plugin-kit/plugin";
import { type Manifest, manifestSchema } from "~/packages/plugin-kit/schema";
import type { HonoEnv } from "~/types/api";

/**
 * Class to manage plugins.
 */
export class PluginLoader {
    private logger = getLogger("plugin");

    /**
     * Get all directories in a given directory.
     * @param {string} dir - The directory to search.
     * @returns {Promise<string[]>} - An array of directory names.
     */
    private static async getDirectories(dir: string): Promise<string[]> {
        const files = await readdir(dir, { withFileTypes: true });
        return files.filter((f) => f.isDirectory()).map((f) => f.name);
    }

    /**
     * Find the manifest file in a given directory.
     * @param {string} dir - The directory to search.
     * @returns {Promise<string | undefined>} - The manifest file name if found, otherwise undefined.
     */
    private static async findManifestFile(
        dir: string,
    ): Promise<string | undefined> {
        const files = await readdir(dir);
        return files.find((f) => f.match(/^manifest\.(json|json5|jsonc)$/));
    }

    /**
     * Check if a directory has an entrypoint file (index.{ts,js}).
     * @param {string} dir - The directory to search.
     * @returns {Promise<boolean>} - True if the entrypoint file is found, otherwise false.
     */
    private static async hasEntrypoint(dir: string): Promise<boolean> {
        const files = await readdir(dir);
        return files.includes("index.ts") || files.includes("index.js");
    }

    /**
     * Parse the manifest file based on its type.
     * @param {string} manifestPath - The path to the manifest file.
     * @param {string} manifestFile - The manifest file name.
     * @returns {Promise<unknown>} - The parsed manifest content.
     * @throws Will throw an error if the manifest file cannot be parsed.
     */
    private async parseManifestFile(
        manifestPath: string,
        manifestFile: string,
    ): Promise<unknown> {
        const manifestText = await file(manifestPath).text();

        try {
            if (manifestFile.endsWith(".json")) {
                return JSON.parse(manifestText);
            }
            if (manifestFile.endsWith(".json5")) {
                return parseJSON5(manifestText);
            }
            if (manifestFile.endsWith(".jsonc")) {
                return parseJSONC(manifestText);
            }

            throw new Error(`Unsupported manifest file type: ${manifestFile}`);
        } catch (e) {
            this.logger
                .fatal`Could not parse plugin manifest ${chalk.blue(manifestPath)} as ${manifestFile.split(".").pop()?.toUpperCase()}.`;
            throw e;
        }
    }

    /**
     * Find all direct subdirectories with a valid manifest file and entrypoint (index.{ts,js}).
     * @param {string} dir - The directory to search.
     * @returns {Promise<string[]>} - An array of plugin directories.
     */
    public static async findPlugins(dir: string): Promise<string[]> {
        const directories = await PluginLoader.getDirectories(dir);
        const plugins: string[] = [];

        for (const directory of directories) {
            const manifestFile = await PluginLoader.findManifestFile(
                `${dir}/${directory}`,
            );
            if (
                manifestFile &&
                (await PluginLoader.hasEntrypoint(`${dir}/${directory}`))
            ) {
                plugins.push(directory);
            }
        }

        return plugins;
    }

    /**
     * Parse the manifest file of a plugin.
     * @param {string} dir - The directory containing the plugin.
     * @param {string} plugin - The plugin directory name.
     * @returns {Promise<Manifest>} - The parsed manifest object.
     * @throws Will throw an error if the manifest file is missing or invalid.
     */
    public async parseManifest(dir: string, plugin: string): Promise<Manifest> {
        const manifestFile = await PluginLoader.findManifestFile(
            `${dir}/${plugin}`,
        );

        if (!manifestFile) {
            throw new Error(`Plugin ${plugin} is missing a manifest file`);
        }

        const manifestPath = `${dir}/${plugin}/${manifestFile}`;
        const manifest = await this.parseManifestFile(
            manifestPath,
            manifestFile,
        );

        const result = await manifestSchema.safeParseAsync(manifest);

        if (!result.success) {
            this.logger
                .fatal`Plugin manifest ${chalk.blue(manifestPath)} is invalid.`;
            throw fromZodError(result.error);
        }

        return result.data;
    }

    /**
     * Loads an entrypoint's default export and check if it's a Plugin.
     * @param {string} dir - The directory containing the entrypoint.
     * @param {string} entrypoint - The entrypoint file name.
     * @returns {Promise<Plugin<ZodTypeAny>>} - The loaded Plugin instance.
     * @throws Will throw an error if the entrypoint's default export is not a Plugin.
     */
    public async loadPlugin(
        dir: string,
        entrypoint: string,
    ): Promise<Plugin<ZodTypeAny>> {
        const plugin = (await import(`${dir}/${entrypoint}`)).default;

        if (plugin instanceof Plugin) {
            return plugin;
        }

        this.logger
            .fatal`Default export of entrypoint ${chalk.blue(entrypoint)} at ${chalk.blue(dir)} is not a Plugin.`;

        throw new Error("Entrypoint is not a Plugin");
    }

    /**
     * Load all plugins in a given directory.
     * @param {string} dir - The directory to search.
     * @returns An array of objects containing the manifest and plugin instance.
     */
    public async loadPlugins(
        dir: string,
        autoload: boolean,
        enabled?: string[],
        disabled?: string[],
    ): Promise<{ manifest: Manifest; plugin: Plugin<ZodTypeAny> }[]> {
        const plugins = await PluginLoader.findPlugins(dir);

        const enabledOn = (enabled?.length ?? 0) > 0;
        const disabledOn = (disabled?.length ?? 0) > 0;

        if (enabledOn && disabledOn) {
            this.logger
                .fatal`Both enabled and disabled lists are specified. Only one of them can be used.`;
            throw new Error("Invalid configuration");
        }

        return Promise.all(
            plugins.map(async (plugin) => {
                const manifest = await this.parseManifest(dir, plugin);

                // If autoload is disabled, only load plugins explicitly enabled
                if (
                    !(autoload || enabledOn || enabled?.includes(manifest.name))
                ) {
                    return null;
                }

                // If enabled is specified, only load plugins in the enabled list
                // If disabled is specified, only load plugins not in the disabled list
                if (enabledOn && !enabled?.includes(manifest.name)) {
                    return null;
                }

                if (disabled?.includes(manifest.name)) {
                    return null;
                }

                const pluginInstance = await this.loadPlugin(
                    dir,
                    `${plugin}/index`,
                );

                return { manifest, plugin: pluginInstance };
            }),
        ).then((data) => data.filter((d) => d !== null));
    }

    public static async addToApp(
        plugins: {
            manifest: Manifest;
            plugin: Plugin<ZodTypeAny>;
        }[],
        app: Hono<HonoEnv>,
        logger: Logger,
    ): Promise<void> {
        for (const data of plugins) {
            logger.info`Loading plugin ${chalk.blueBright(data.manifest.name)} ${chalk.blueBright(data.manifest.version)} ${chalk.gray(`[${plugins.indexOf(data) + 1}/${plugins.length}]`)}`;

            const time1 = performance.now();

            try {
                // biome-ignore lint/complexity/useLiteralKeys: loadConfig is a private method
                await data.plugin["_loadConfig"](
                    config.plugins?.config?.[data.manifest.name],
                );
            } catch (e) {
                logger.fatal`Error encountered while loading plugin ${chalk.blueBright(data.manifest.name)} ${chalk.blueBright(data.manifest.version)} configuration.`;
                logger.fatal`This is due to invalid, missing or incomplete configuration.`;
                logger.fatal`Put your configuration at ${chalk.blueBright(
                    "plugins.config.<plugin-name>",
                )}`;
                logger.fatal`Here is the error message, please fix the configuration file accordingly:`;
                logger.fatal`${(e as ValidationError).message}`;

                await sleep(Number.POSITIVE_INFINITY);
            }

            const time2 = performance.now();

            // biome-ignore lint/complexity/useLiteralKeys: AddToApp is a private method
            await data.plugin["_addToApp"](app);

            const time3 = performance.now();

            logger.info`Plugin ${chalk.blueBright(data.manifest.name)} ${chalk.blueBright(
                data.manifest.version,
            )} loaded in ${chalk.gray(
                `${(time2 - time1).toFixed(2)}ms`,
            )} and added to app in ${chalk.gray(`${(time3 - time2).toFixed(2)}ms`)}`;
        }
    }
}
