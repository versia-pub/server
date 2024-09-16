import { apiRoute, applyConfig } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { exportJWK } from "jose";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 30,
        max: 60,
    },
    route: "/.well-known/jwks",
});

const route = createRoute({
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
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const publicKey = await crypto.subtle.importKey(
            "spki",
            Buffer.from(config.oidc.keys?.public ?? "", "base64"),
            "Ed25519",
            true,
            ["verify"],
        );

        const jwk = await exportJWK(publicKey);

        // Remove the private key
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
    }),
);
