import { z } from "zod";
import { Hooks } from "./hooks";
import { Plugin, PluginConfigManager } from "./plugin";

const configManager = new PluginConfigManager(
    z.object({
        apiKey: z.string(),
    }),
);

const myPlugin = new Plugin(configManager);

myPlugin.registerHandler(Hooks.Response, (req) => {
    console.info("Request received:", req);
    return req;
});
