import { applyConfig } from "@/api";
import { jsonResponse } from "@/response";
import type { Hono } from "hono";
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
    route: "/.well-known/openid-configuration",
});

export default (app: Hono) =>
    app.on(meta.allowedMethods, meta.route, () => {
        const baseUrl = new URL(config.http.base_url);
        return jsonResponse({
            issuer: baseUrl.origin.toString(),
            authorization_endpoint: `${baseUrl.origin}/oauth/authorize`,
            token_endpoint: `${baseUrl.origin}/oauth/token`,
            userinfo_endpoint: `${baseUrl.origin}/api/v1/accounts/verify_credentials`,
            jwks_uri: `${baseUrl.origin}/.well-known/jwks`,
            response_types_supported: ["code"],
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["EdDSA"],
            scopes_supported: ["openid", "profile", "email"],
            token_endpoint_auth_methods_supported: ["client_secret_basic"],
            claims_supported: ["sub"],
        });
    });
