import { auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { exportJWK } from "jose";
import type { PluginType } from "../index.ts";

export default (plugin: PluginType): void => {
    plugin.registerRoute("/.well-known/jwks", (app) =>
        app.openapi(
            createRoute({
                method: "get",
                path: "/.well-known/jwks",
                summary: "JWK Set",
                responses: {
                    200: {
                        description: "JWK Set",
                        content: {
                            "application/json": {
                                schema: z.object({
                                    keys: z.array(
                                        z.object({
                                            kty: z.string(),
                                            use: z.string(),
                                            alg: z.string(),
                                            kid: z.string(),
                                            crv: z.string().optional(),
                                            x: z.string().optional(),
                                            y: z.string().optional(),
                                        }),
                                    ),
                                }),
                            },
                        },
                    },
                },
                middleware: [
                    auth({
                        required: false,
                    }),
                    plugin.middleware,
                ] as const,
            }),
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
