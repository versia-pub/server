import { applyConfig } from "@/api";
import { jsonResponse } from "@/response";
import type { Hono } from "hono";
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

export default (app: Hono) =>
    app.on(meta.allowedMethods, meta.route, async () => {
        const publicKey = await crypto.subtle.importKey(
            "spki",
            Buffer.from(config.oidc.jwt_key.split(";")[1], "base64"),
            "Ed25519",
            true,
            ["verify"],
        );

        const jwk = await exportJWK(publicKey);

        // Remove the private key
        jwk.d = undefined;

        return jsonResponse({
            keys: [
                {
                    ...jwk,
                    use: "sig",
                    alg: "EdDSA",
                    kid: "1",
                },
            ],
        });
    });
