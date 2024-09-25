import { z } from "zod";
import { Hooks } from "./hooks";
import { Plugin } from "./plugin";

const myPlugin = new Plugin(
    z.object({
        apiKey: z.string(),
    }),
);

myPlugin.registerHandler(Hooks.Response, (req) => {
    console.info("Request received:", req);
    return req;
});
