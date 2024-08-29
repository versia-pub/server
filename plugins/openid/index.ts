import { Hooks, type Manifest, Plugin, PluginConfigManager } from "@versia/kit";
import { z } from "zod";
import authorizeRoute from "./routes/authorize";

const myManifest: Manifest = {
    name: "@versia/openid",
    description: "OpenID authentication.",
    version: "0.1.0",
};

const configManager = new PluginConfigManager(
    z.object({
        forced: z.boolean().default(false),
        allow_registration: z.boolean().default(true),
        providers: z
            .array(
                z.object({
                    name: z.string().min(1),
                    id: z.string().min(1),
                    url: z.string().min(1),
                    client_id: z.string().min(1),
                    client_secret: z.string().min(1),
                    icon: z.string().min(1).optional(),
                }),
            )
            .default([]),
        keys: z.object({
            public: z
                .string()
                .min(1)
                .transform(async (v) => {
                    try {
                        return await crypto.subtle.importKey(
                            "spki",
                            Buffer.from(v, "base64"),
                            "Ed25519",
                            true,
                            ["verify"],
                        );
                    } catch {
                        throw new Error(
                            "Public key at oidc.keys.public is invalid",
                        );
                    }
                }),
            private: z
                .string()
                .min(1)
                .transform(async (v) => {
                    try {
                        return await crypto.subtle.importKey(
                            "pkcs8",
                            Buffer.from(v, "base64"),
                            "Ed25519",
                            true,
                            ["sign"],
                        );
                    } catch {
                        throw new Error(
                            "Private key at oidc.keys.private is invalid",
                        );
                    }
                }),
        }),
    }),
);

const plugin = new Plugin(myManifest, configManager);

plugin.registerHandler(Hooks.Response, (req) => {
    console.info("Request received:", req);
    return req;
});
authorizeRoute(plugin);

export type PluginType = typeof plugin;
export default plugin;
