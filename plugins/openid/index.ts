import { Hooks, Plugin } from "@versia/kit";
import { z } from "zod";
import authorizeRoute from "./routes/authorize";
import tokenRevokeRoute from "./routes/oauth/revoke";
import tokenRoute from "./routes/oauth/token";
import ssoRoute from "./routes/sso";
import ssoIdRoute from "./routes/sso/:id/index";

const plugin = new Plugin(
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

// Test hook for screenshots
plugin.registerHandler(Hooks.Response, (req) => {
    console.info("Request received:", req);
    return req;
});

authorizeRoute(plugin);
ssoRoute(plugin);
ssoIdRoute(plugin);
tokenRoute(plugin);
tokenRevokeRoute(plugin);

export type PluginType = typeof plugin;
export default plugin;
