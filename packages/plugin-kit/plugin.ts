import { createMiddleware } from "@hono/hono/factory";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { z } from "zod";
import { type ZodError, fromZodError } from "zod-validation-error";
import type { HonoEnv } from "~/types/api";
import type { ServerHooks } from "./hooks";

export type HonoPluginEnv<ConfigType extends z.ZodTypeAny> = HonoEnv & {
    Variables: {
        pluginConfig: z.infer<ConfigType>;
    };
};

export class Plugin<ConfigSchema extends z.ZodTypeAny> {
    private handlers: Partial<ServerHooks> = {};
    private routes: {
        path: string;
        fn: (app: OpenAPIHono<HonoPluginEnv<ConfigSchema>>) => void;
    }[] = [];

    constructor(private configManager: PluginConfigManager<ConfigSchema>) {}

    get middleware() {
        // Middleware that adds the plugin's configuration to the request object
        return createMiddleware<HonoPluginEnv<ConfigSchema>>(
            async (context, next) => {
                context.set("pluginConfig", this.configManager.getConfig());
                await next();
            },
        );
    }

    public registerRoute(
        path: string,
        fn: (app: OpenAPIHono<HonoPluginEnv<ConfigSchema>>) => void,
    ) {
        this.routes.push({
            path,
            fn,
        });
    }

    /**
     * Loads the plugin's configuration from the Versia Server configuration file.
     * This will be called when the plugin is loaded.
     * @param config Values the user has set in the configuration file.
     */
    protected _loadConfig(config: z.input<ConfigSchema>): Promise<void> {
        // biome-ignore lint/complexity/useLiteralKeys: Private method
        return this.configManager["_load"](config);
    }

    protected _addToApp(app: OpenAPIHono<HonoEnv>) {
        for (const route of this.routes) {
            app.use(route.path, this.middleware);
            route.fn(
                app as unknown as OpenAPIHono<HonoPluginEnv<ConfigSchema>>,
            );
        }
    }

    public registerHandler<HookName extends keyof ServerHooks>(
        hook: HookName,
        handler: ServerHooks[HookName],
    ) {
        this.handlers[hook] = handler;
    }

    static [Symbol.hasInstance](instance: unknown): boolean {
        return (
            typeof instance === "object" &&
            instance !== null &&
            "registerHandler" in instance
        );
    }
}

/**
 * Handles loading, defining, and managing the plugin's configuration.
 * Plugins can define their own configuration schema, which is then used to
 * load it from the user's configuration file.
 * @param schema The Zod schema that defines the configuration.
 */
export class PluginConfigManager<Schema extends z.ZodTypeAny> {
    private store: z.infer<Schema> | null;

    constructor(private schema: Schema) {
        this.store = null;
    }

    /**
     * Loads the configuration from the Versia Server configuration file.
     * This will be called when the plugin is loaded.
     * @param config Values the user has set in the configuration file.
     */
    protected async _load(config: z.infer<Schema>) {
        // Check if the configuration is valid
        try {
            this.store = await this.schema.parseAsync(config);
        } catch (error) {
            throw fromZodError(error as ZodError).message;
        }
    }

    /**
     * Returns the internal configuration object.
     */
    public getConfig() {
        if (!this.store) {
            throw new Error("Configuration has not been loaded yet.");
        }

        return this.store;
    }
}
