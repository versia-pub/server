import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { exportJWK } from "jose";
import { z } from "zod";
import { auth } from "@/api";
import type { PluginType } from "../index.ts";

export default (plugin: PluginType): void => {
    plugin.registerRoute("/.well-known/jwks", (app) =>
        app.get(
            "/.well-known/jwks",
            describeRoute({
                summary: "JWK Set",
                tags: ["OpenID"],
                responses: {
                    200: {
                        description: "JWK Set",
                        content: {
                            "application/json": {
                                schema: resolver(
                                    z.object({
                                        keys: z.array(
                                            z.object({
                                                kty: z.string().optional(),
                                                use: z.string(),
                                                alg: z.string(),
                                                kid: z.string(),
                                                crv: z.string().optional(),
                                                x: z.string().optional(),
                                                y: z.string().optional(),
                                            }),
                                        ),
                                    }),
                                ),
                            },
                        },
                    },
                },
            }),
            auth({
                auth: false,
            }),
            plugin.middleware,
            async (context) => {
                const jwk = await exportJWK(
                    context.get("pluginConfig").keys?.public,
                );

                // Remove the private key 💀
                jwk.d = undefined;

                return context.json(
                    {
                        keys: [
                            {
                                ...jwk,
                                use: "sig",
                                alg: "EdDSA",
                                kid: "1",
                            },
                        ],
                    },
                    200,
                );
            },
        ),
    );
};
