import { config } from "@versia-server/config";
import { apiRoute, auth } from "@versia-server/kit/api";
import { describeRoute, resolver } from "hono-openapi";
import { exportJWK } from "jose";
import { z } from "zod/v4";

export default apiRoute((app) => {
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
        async (context) => {
            const jwk = await exportJWK(config.authentication.keys.private);

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
    );
});
