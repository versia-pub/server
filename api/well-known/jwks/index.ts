import { apiRoute, applyConfig } from "@/api";
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

export default apiRoute((app) =>
    app.on(meta.allowedMethods, meta.route, async (context) => {
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

        return context.json({
            keys: [
                {
                    ...jwk,
                    use: "sig",
                    alg: "EdDSA",
                    kid: "1",
                },
            ],
        });
    }),
);
