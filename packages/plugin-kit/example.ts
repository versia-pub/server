import { z } from "zod";
import { Hooks } from "./hooks.ts";
import { Plugin } from "./plugin.ts";

const myPlugin = new Plugin(
    z.object({
        apiKey: z.string(),
    }),
);

myPlugin.registerHandler(Hooks.Response, (req) => {
    console.info("Request received:", req);
    return req;
});

export default myPlugin;
