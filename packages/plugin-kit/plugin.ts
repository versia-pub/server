import type { z } from "zod";
import { type ZodError, fromZodError } from "zod-validation-error";
import type { ServerHooks } from "./hooks";
import { type Manifest, manifestSchema } from "./schema";

export class Plugin<ConfigSchema extends z.ZodTypeAny> {
    private handlers: Partial<ServerHooks> = {};

    constructor(
        private manifest: Manifest,
        private configManager: PluginConfigManager<ConfigSchema>,
    ) {
        this.validateManifest(manifest);
    }

    public getManifest() {
        return this.manifest;
    }

    /**
     * Loads the plugin's configuration from the Lysand Server configuration file.
     * This will be called when the plugin is loaded.
     * @param config Values the user has set in the configuration file.
     */
    protected _loadConfig(config: z.infer<ConfigSchema>) {
        // biome-ignore lint/complexity/useLiteralKeys: Private method
        this.configManager["_load"](config);
    }

    public registerHandler<HookName extends keyof ServerHooks>(
        hook: HookName,
        handler: ServerHooks[HookName],
    ) {
        this.handlers[hook] = handler;
    }

    private validateManifest(manifest: Manifest) {
        try {
            manifestSchema.parse(manifest);
        } catch (error) {
            throw fromZodError(error as ZodError);
        }
    }

    static [Symbol.hasInstance](instance: unknown): boolean {
        return (
            typeof instance === "object" &&
            instance !== null &&
            "getManifest" in instance &&
            "registerHandler" in instance
        );
    }
}

/**
 * Handles loading, defining, and managing the plugin's configuration.
 * Plugins can define their own configuration schema, which is then used to
 * load it from the user's configuration file.
 */
export class PluginConfigManager<Schema extends z.ZodTypeAny> {
    private store: z.infer<Schema> | null;

    constructor(private schema: Schema) {
        this.store = null;
    }

    /**
     * Loads the configuration from the Lysand Server configuration file.
     * This will be called when the plugin is loaded.
     * @param config Values the user has set in the configuration file.
     */
    protected _load(config: z.infer<Schema>) {
        // Check if the configuration is valid
        try {
            this.schema.parse(config);
        } catch (error) {
            throw fromZodError(error as ZodError);
        }
    }

    /**
     * Returns the internal configuration object.
     */
    public getConfig() {
        return this.store;
    }
}
