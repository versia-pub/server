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
    private store: z.infer<ConfigSchema> | null = null;
    private routes: {
        path: string;
        fn: (app: OpenAPIHono<HonoPluginEnv<ConfigSchema>>) => void;
    }[] = [];

    constructor(private configSchema: ConfigSchema) {}

    get middleware() {
        // Middleware that adds the plugin's configuration to the request object
        return createMiddleware<HonoPluginEnv<ConfigSchema>>(
            async (context, next) => {
                context.set("pluginConfig", this.getConfig());
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
    protected async _loadConfig(config: z.input<ConfigSchema>): Promise<void> {
        try {
            this.store = await this.configSchema.parseAsync(config);
        } catch (error) {
            throw fromZodError(error as ZodError).message;
        }
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

    /**
     * Returns the internal configuration object.
     */
    private getConfig() {
        if (!this.store) {
            throw new Error("Configuration has not been loaded yet.");
        }

        return this.store;
    }
}
